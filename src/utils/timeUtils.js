// Получение текущего времени в Москве
export const getMoscowTime = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
};

// Проверка, является ли текущее время началом нового дня в Москве (00:00)
export const isNewDayInMoscow = () => {
  const moscowTime = getMoscowTime();
  return moscowTime.getHours() === 0 && moscowTime.getMinutes() === 0;
};

// Получение начала текущего дня в Москве
export const getStartOfDayInMoscow = () => {
  const moscowTime = getMoscowTime();
  moscowTime.setHours(0, 0, 0, 0);
  return moscowTime;
};

// Получение конца текущего дня в Москве (23:59:59)
export const getEndOfDayInMoscow = () => {
  const moscowTime = getMoscowTime();
  moscowTime.setHours(23, 59, 59, 999);
  return moscowTime;
};

// Проверка, находится ли запись в пределах текущего дня в Москве
export const isEntryInCurrentMoscowDay = (entryTimestamp) => {
  const entryDate = new Date(entryTimestamp);
  const startOfDay = getStartOfDayInMoscow();
  const endOfDay = getEndOfDayInMoscow();
  return entryDate >= startOfDay && entryDate <= endOfDay;
}; 