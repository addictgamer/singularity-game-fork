export function prerequisitesAvailable(
  prerequisites: string[],
  researchedTechs: Set<string>
): boolean {
  let orMode = false;
  for (let index = 0; index < prerequisites.length; index += 1) {
    const prerequisite = prerequisites[index];
    if (prerequisite === "impossible") {
      return false;
    }
    if (prerequisite === "OR") {
      orMode = true;
      continue;
    }
    const hasTech = researchedTechs.has(prerequisite);
    if (hasTech && orMode) {
      return true;
    }
    if (!hasTech && !orMode) {
      return false;
    }
  }
  return !orMode;
}