package com.pandafit.core.common

import java.text.Normalizer

fun String.normalizeSearch(): String =
    Normalizer.normalize(this, Normalizer.Form.NFD)
        .replace(Regex("\\p{M}"), "")
        .lowercase()
        .trim()
