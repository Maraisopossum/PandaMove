# Corrections manuelles après classification Gemini : numéro de zone -> groupe (None : aucun muscle)
CORRECTIONS = {
    ('female', 'face'): {60: 'PECTORAUX', 74: 'QUADRICEPS', 75: 'QUADRICEPS', 83: 'QUADRICEPS', 85: 'QUADRICEPS'},
}
# Découpe : un groupe ne descend pas sous cette ordonnée (cuisses arrêtées au genou)
LIMITES_Y = {('female', 'face'): {'QUADRICEPS': 650}}
