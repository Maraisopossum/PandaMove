package com.pandafit.core.common

sealed interface Result<out T> {
    data class Success<T>(val data: T) : Result<T>
    data class Error(val exception: Throwable, val message: String? = null) : Result<Nothing>
    data object Loading : Result<Nothing>
}

inline fun <T, R> Result<T>.map(transform: (T) -> R): Result<R> = when (this) {
    is Result.Success -> Result.Success(transform(data))
    is Result.Error -> this
    Result.Loading -> Result.Loading
}

fun <T> Result<T>.getOrNull(): T? = (this as? Result.Success)?.data

fun <T> Result<T>.getOrDefault(default: T): T = getOrNull() ?: default
