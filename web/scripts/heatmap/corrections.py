# Corrections manuelles après classification Gemini : numéro de zone -> groupe (None : aucun muscle).
# Numéros : planches assets/11_Heatmaps/legendes/zones_*.png (ou correction/tableau_zones.html).
# Un groupe peut être placé sur l'autre vue que la sienne (ex. TRICEPS vus de face) : il y est alors tracé aussi.
CORRECTIONS = {
    # Relevé de Benoît (tableau_zones.html, 2026-11-12)
    ('male', 'face'): {61: 'AVANT_BRAS', 77: 'TRICEPS', 78: 'TRICEPS', 79: 'PECTORAUX', 82: 'BICEPS',
                       92: 'DOS', 93: 'DOS', 94: 'DOS', 95: 'DOS', 108: 'OBLIQUES', 118: None, 119: None},
    ('male', 'dos'): {20: 'AVANT_BRAS', 21: 'AVANT_BRAS', 24: 'AVANT_BRAS', 25: 'AVANT_BRAS', 31: 'AVANT_BRAS', 32: 'AVANT_BRAS',
                      39: 'BICEPS', 40: 'BICEPS', 51: 'BICEPS', 52: 'BICEPS', 41: 'EPAULES', 43: 'EPAULES', 169: 'LOMBAIRES'},
    ('female', 'face'): {60: 'PECTORAUX', 74: 'QUADRICEPS', 75: 'QUADRICEPS', 83: 'QUADRICEPS', 85: 'QUADRICEPS',
                         40: 'AVANT_BRAS', 66: 'DOS', 67: 'DOS'},
    # Vue femme de dos : la partie verticale du bras levé est l'avant-bras (pas le triceps) ; les bandes le long de
    # l'extérieur des cuisses ne sont pas des fessiers
    ('female', 'dos'): {48: 'AVANT_BRAS', 49: 'AVANT_BRAS', 162: None, 163: None},
}
# Découpe : un groupe ne descend pas sous cette ordonnée (cuisses arrêtées au genou)
LIMITES_Y = {('female', 'face'): {'QUADRICEPS': 650}}
# Vue femme de face : abdos et obliques forment une seule zone dessinée ; ses bords (hors de x 255..345) sont les obliques
DECOUPES_X = {('female', 'face'): {'ABDOMINAUX': ('OBLIQUES', 255, 345)}}
