// Generate graduation years (current year to 10 years in the future)
export const getGraduationYears = (): number[] => {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let i = 0; i <= 10; i++) {
    years.push(currentYear + i);
  }
  return years;
};

