package com.pandafit.feature.strength.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.dao.InstanceSeanceDao
import com.pandafit.core.database.dao.SeanceDao
import com.pandafit.core.database.entities.InstanceSeanceEntity
import com.pandafit.core.database.entities.SeanceCategory
import com.pandafit.core.database.entities.SeanceEntity
import com.pandafit.feature.strength.model.SeanceListUiState
import kotlinx.coroutines.flow.Flow
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

@HiltViewModel
class SeanceListViewModel @Inject constructor(
    private val seanceDao: SeanceDao,
    private val instanceSeanceDao: InstanceSeanceDao,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SeanceListUiState())
    val uiState: StateFlow<SeanceListUiState> = _uiState.asStateFlow()

    /** Émis après createOneShotInstance() pour naviguer vers l'instance créée. */
    private val _navigateToInstance = MutableSharedFlow<Long>(extraBufferCapacity = 1)
    val navigateToInstance: SharedFlow<Long> = _navigateToInstance.asSharedFlow()

    init {
        viewModelScope.launch {
            combine(
                seanceDao.observeByCategory(SeanceCategory.STRENGTH),
                seanceDao.observeByCategory(SeanceCategory.STRENGTH_ONESHOT),
                seanceDao.observeArchivedByCategory(SeanceCategory.STRENGTH),
                instanceSeanceDao.observeAll(),
            ) { seances, oneShotSeances, archivedSeances, instances ->
                // seances = templates affichés dans "Séances types"
                // oneShotSeances = séances directes (ne s'affichent pas comme templates)
                // archivedSeances = templates masqués (cf. deleteSeances) — affichés à part, purgeables
                // byId = union des trois → résolution du nom sur toutes les cartes instances
                val byId = (seances + oneShotSeances + archivedSeances).associateBy { it.id }
                SeanceListUiState(
                    isLoading = false, seances = seances, archivedSeances = archivedSeances,
                    instances = instances, seancesById = byId,
                )
            }
                .catch { e -> _uiState.value = _uiState.value.copy(error = e.message) }
                .collect { _uiState.value = it }
        }
    }

    /** Supprime le template, sauf s'il a déjà des instances : dans ce cas on l'archive (masqué de la
     * liste "Séances types" mais conservé en base, visible dans "Séances archivées") pour ne jamais
     * perdre l'historique des séances déjà réalisées. Un template déjà archivé qu'on sélectionne à
     * nouveau ici est une purge définitive assumée — il est supprimé pour de bon, quel que soit son
     * nombre d'instances restantes (KNOWN_BUGS.md : sans ce second passage, un template archivé était
     * un mort-vivant en base, ni supprimable ni ré-importable). */
    fun deleteSeances(ids: Set<Long>) {
        viewModelScope.launch {
            (_uiState.value.seances + _uiState.value.archivedSeances).filter { it.id in ids }.forEach { seance ->
                if (!seance.isArchived && instanceSeanceDao.countForSeance(seance.id) > 0) {
                    seanceDao.updateSeance(seance.copy(isArchived = true))
                } else {
                    seanceDao.deleteSeance(seance)
                }
            }
        }
    }

    fun deleteInstances(ids: Set<Long>) {
        viewModelScope.launch {
            _uiState.value.instances.filter { it.id in ids }.forEach { instance ->
                seanceDao.deleteBlocsForInstance(instance.id)
                seanceDao.deleteExercicesForInstance(instance.id)
                instanceSeanceDao.deleteInstance(instance)
                // Nettoyage : si la SeanceEntity parente est STRENGTH_ONESHOT, la supprimer aussi
                // (elle n'a pas de raison d'exister sans instance et n'apparaît pas dans la liste templates)
                val parentSeance = seanceDao.getById(instance.seanceId)
                if (parentSeance?.seanceCategory == SeanceCategory.STRENGTH_ONESHOT) {
                    seanceDao.deleteSeance(parentSeance)
                }
            }
        }
    }

    /**
     * Crée une séance one-shot (STRENGTH_ONESHOT) planifiée à une date, sans template réutilisable.
     * Navigue automatiquement vers l'instance créée via [navigateToInstance].
     */
    fun createOneShotInstance(nom: String, date: LocalDate) {
        viewModelScope.launch {
            val seanceId = seanceDao.insertSeance(
                SeanceEntity(
                    nom = nom.ifBlank { "Séance du ${date.dayOfMonth}/${date.monthValue}" },
                    seanceCategory = SeanceCategory.STRENGTH_ONESHOT,
                )
            )
            val instanceId = instanceSeanceDao.insertInstance(
                InstanceSeanceEntity(seanceId = seanceId, date = date)
            )
            _navigateToInstance.tryEmit(instanceId)
        }
    }

    /** Duplique une séance type avec ses blocs et exercices (template uniquement). */
    fun duplicateSeance(id: Long) {
        viewModelScope.launch {
            val full = seanceDao.getSeanceFull(id) ?: return@launch
            val newSeanceId = seanceDao.insertSeance(
                full.seance.copy(id = 0, nom = "${full.seance.nom} (copie)")
            )
            val blocIdMap = mutableMapOf<Long, Long>()
            full.blocs.filter { it.instanceSeanceId == null }.forEach { bloc ->
                val newBlocId = seanceDao.insertBloc(bloc.copy(id = 0, seanceId = newSeanceId))
                blocIdMap[bloc.id] = newBlocId
            }
            full.exercices.filter { it.exerciceSeance.instanceSeanceId == null }.forEach { exWithEx ->
                val ex = exWithEx.exerciceSeance
                seanceDao.insertExerciceSeance(ex.copy(id = 0, seanceId = newSeanceId, blocId = ex.blocId?.let { blocIdMap[it] }))
            }
        }
    }

    /** Copie les blocs et exercices du template dans une instance indépendante. */
    private suspend fun copySeanceToInstance(seanceId: Long, date: LocalDate) {
        val full = seanceDao.getSeanceFull(seanceId) ?: return
        val instanceId = instanceSeanceDao.insertInstance(InstanceSeanceEntity(seanceId = seanceId, date = date))
        val blocIdMap = mutableMapOf<Long, Long>()
        full.blocs.filter { it.instanceSeanceId == null }.sortedBy { it.position }.forEach { bloc ->
            val newId = seanceDao.insertBloc(bloc.copy(id = 0, instanceSeanceId = instanceId))
            blocIdMap[bloc.id] = newId
        }
        full.exercices.filter { it.exerciceSeance.instanceSeanceId == null }.forEach { exWithEx ->
            val ex = exWithEx.exerciceSeance
            seanceDao.insertExerciceSeance(
                ex.copy(id = 0, instanceSeanceId = instanceId, blocId = ex.blocId?.let { blocIdMap[it] })
            )
        }
    }

    fun assignToDate(seanceId: Long, date: LocalDate) {
        viewModelScope.launch { copySeanceToInstance(seanceId, date) }
    }

    fun assignToDates(seanceId: Long, dates: Set<LocalDate>) {
        viewModelScope.launch { dates.forEach { copySeanceToInstance(seanceId, it) } }
    }

    fun assignRecurring(seanceId: Long, startDate: LocalDate, intervalDays: Int, occurrences: Int) {
        viewModelScope.launch {
            repeat(occurrences) { i ->
                copySeanceToInstance(seanceId, startDate.plusDays((i * intervalDays).toLong()))
            }
        }
    }

    /** Déplace une séance planifiée vers une nouvelle date, sans la recréer. Ignoré si déjà terminée. */
    fun rescheduleInstance(id: Long, newDate: LocalDate) {
        viewModelScope.launch {
            val instance = instanceSeanceDao.getById(id) ?: return@launch
            if (!instance.isCompleted) instanceSeanceDao.updateInstance(instance.copy(date = newDate))
        }
    }

    fun getWarmupSeances(): Flow<List<SeanceEntity>> = seanceDao.observeAllWarmups()
}
