// PostgREST errors are plain objects, not instances of Error.
export function productSaveError(error: unknown): string {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const message = typeof record.message === 'string' ? record.message : typeof error === 'string' ? error : '';
  const code = typeof record.code === 'string' ? record.code : '';
  if (/products_(fit|style)_valid/.test(message)) {
    return 'La base de datos todavía rechaza el fit o estilo personalizado. Conserva tus datos: hace falta actualizar esa validación antes de guardar.';
  }
  if (/price_positive/.test(message)) return 'El precio debe ser mayor a cero.';
  if (code === '42501') return 'Tu sesión no tiene permiso para guardar este producto. Revisa el acceso de tu usuario.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return 'No se pudo conectar al servidor. Revisa tu conexión.';
  return message ? `${message}${code ? ` (código ${code})` : ''}` : 'El servidor no devolvió el motivo del fallo. Conserva este formulario y contacta al administrador.';
}
