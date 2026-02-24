/**
 * Parses relative date expressions into Date objects.
 * Supports: "today", "-85y", "+1d", "-18y", "+6m", ISO date strings.
 */
function parseRelativeDate(expr) {
  if (!expr || typeof expr !== 'string') return null;

  const trimmed = expr.trim().toLowerCase();

  if (trimmed === 'today') {
    return startOfDay(new Date());
  }

  // Try relative expression: +/-Ny, +/-Nm, +/-Nd
  const match = trimmed.match(/^([+-]?\d+)([ymd])$/);
  if (match) {
    const amount = parseInt(match[1], 10);
    const unit = match[2];
    const d = startOfDay(new Date());

    switch (unit) {
      case 'y':
        d.setFullYear(d.getFullYear() + amount);
        break;
      case 'm':
        d.setMonth(d.getMonth() + amount);
        break;
      case 'd':
        d.setDate(d.getDate() + amount);
        break;
    }
    return d;
  }

  // Try ISO date string
  const parsed = new Date(expr);
  if (!isNaN(parsed.getTime())) {
    return startOfDay(parsed);
  }

  return null;
}

function startOfDay(d) {
  const result = new Date(d);
  result.setHours(0, 0, 0, 0);
  return result;
}

function todayISO() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

module.exports = { parseRelativeDate, startOfDay, todayISO };
