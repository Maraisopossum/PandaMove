package com.pandafit.feature.breathing.audio

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import com.pandafit.feature.breathing.engine.BreathingPhase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.PI
import kotlin.math.sin

/**
 * Gestion audio PCM pour les sessions de respiration.
 *
 * Pendant chaque phase active, joue une tonalité continue synthétisée (AudioTrack STREAM)
 * avec fondu entrant et sortant pour un rendu doux. La tonalité est propre à la phase :
 *   - INHALE    → 432 Hz
 *   - HOLD_IN   → 440 Hz
 *   - EXHALE    → 396 Hz
 *   - HOLD_OUT  → silence
 *
 * Un bip court distinct (660 Hz) est joué à chaque seconde du décompte.
 */
@Singleton
class BreathingAudioManager @Inject constructor() {

    companion object {
        private const val SAMPLE_RATE = 44_100
        private const val FADE_MS     = 200   // fondu in/out pour les tons continus
        private const val VOLUME      = 0.55f // amplitude relative (0..1)

        private const val TICK_FREQ_HZ   = 660.0
        private const val TICK_DURATION_MS = 80
        private const val TICK_FADE_MS   = 12

        private val PHASE_FREQUENCY = mapOf(
            BreathingPhase.INHALE   to 432.0,
            BreathingPhase.HOLD_IN  to 440.0,
            BreathingPhase.EXHALE   to 396.0,
            BreathingPhase.HOLD_OUT to null,  // silence
        )
    }

    private val audioScope = CoroutineScope(Dispatchers.IO)
    private var toneJob: Job? = null

    /** Démarre une tonalité continue pour la [phase] sur la durée [durationMs]. */
    fun startPhaseTone(phase: BreathingPhase, durationMs: Long) {
        toneJob?.cancel()
        val frequency = PHASE_FREQUENCY[phase] ?: return   // silence = on ne joue rien
        toneJob = audioScope.launch {
            playToneContinuous(frequency, durationMs)
        }
    }

    /** Arrête immédiatement la tonalité en cours (pause, stop, fin de session). */
    fun stopPhaseTone() {
        toneJob?.cancel()
        toneJob = null
    }

    /** Joue un bip court pour le décompte. */
    fun playCountdownTick() {
        audioScope.launch { playShortTone(TICK_FREQ_HZ, TICK_DURATION_MS, TICK_FADE_MS) }
    }

    // ── Synthèse PCM ────────────────────────────────────────────────────────────

    /** Génère et diffuse en streaming une sinusoïde à [frequency] Hz pendant [durationMs] ms. */
    private suspend fun playToneContinuous(frequency: Double, durationMs: Long) {
        val totalSamples = (SAMPLE_RATE * durationMs / 1_000L).toInt()
        val fadeSamples  = (SAMPLE_RATE * FADE_MS / 1_000L).toInt()
        val chunkSize    = SAMPLE_RATE / 20  // 50 ms par chunk → réactivité à l'annulation

        val minBuf = AudioTrack.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
        )
        val track = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setSampleRate(SAMPLE_RATE)
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
            )
            .setBufferSizeInBytes(maxOf(minBuf, chunkSize * 2 * Short.SIZE_BYTES))
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()

        try {
            track.play()
            val buf = ShortArray(chunkSize)
            var written = 0
            while (written < totalSamples && currentCoroutineContext().isActive) {
                val toWrite = minOf(chunkSize, totalSamples - written)
                for (i in 0 until toWrite) {
                    val s   = written + i
                    val raw = sin(2.0 * PI * frequency * s / SAMPLE_RATE)
                    val env = when {
                        s < fadeSamples              -> s.toDouble() / fadeSamples
                        s > totalSamples - fadeSamples -> (totalSamples - s).toDouble().coerceAtLeast(0.0) / fadeSamples
                        else                          -> 1.0
                    }
                    buf[i] = (raw * env.coerceIn(0.0, 1.0) * Short.MAX_VALUE * VOLUME).toInt().toShort()
                }
                track.write(buf, 0, toWrite)
                written += toWrite
            }
            track.stop()
        } finally {
            runCatching { track.release() }
        }
    }

    /** Génère et joue un bip court (MODE_STATIC). */
    private fun playShortTone(frequency: Double, durationMs: Int, fadeMs: Int) {
        val numSamples = SAMPLE_RATE * durationMs / 1_000
        val fadeSamples = SAMPLE_RATE * fadeMs / 1_000
        val buf = ShortArray(numSamples)
        for (i in 0 until numSamples) {
            val raw = sin(2.0 * PI * frequency * i / SAMPLE_RATE)
            val env = when {
                i < fadeSamples               -> i.toDouble() / fadeSamples
                i > numSamples - fadeSamples  -> (numSamples - i).toDouble() / fadeSamples
                else                          -> 1.0
            }
            buf[i] = (raw * env.coerceIn(0.0, 1.0) * Short.MAX_VALUE * 0.45).toInt().toShort()
        }
        val minBuf = AudioTrack.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT)
        val track = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setSampleRate(SAMPLE_RATE)
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
            )
            .setBufferSizeInBytes(maxOf(minBuf, buf.size * Short.SIZE_BYTES))
            .setTransferMode(AudioTrack.MODE_STATIC)
            .build()
        runCatching {
            track.write(buf, 0, buf.size)
            track.play()
            Thread.sleep(durationMs.toLong() + 20L)
            track.stop()
            track.release()
        }.onFailure { runCatching { track.release() } }
    }

    fun release() {
        toneJob?.cancel()
        toneJob = null
    }
}
