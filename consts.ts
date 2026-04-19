export const PARALLEL_ANALYZE_IMAGE = parseInt(process.env.PARALLEL_ANALYZE_IMAGE || "7");

export const ACCEPTED_DAY_OF_WEEK = [
  "Sunday", "Monday", "Tuesday", "Wednesday", 
  "Thursday", "Friday", "Saturday"
];

export const validateDayOfWeekInput = (dayOfWeekInput: string) => {
  return ACCEPTED_DAY_OF_WEEK.some(accepted => {
    return accepted.trim().toUpperCase() === dayOfWeekInput.trim().toUpperCase()
  })
}

export const getDayOfWeekInput = () => {
  const rawInput = (process.env.DAY as string || '').trim();
  if (!validateDayOfWeekInput(rawInput)) {
    throw new Error(`Day of week invalid: ${rawInput}`);
  }
  return rawInput;
}