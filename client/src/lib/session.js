// Async work must belong to the current authenticated session.
let generation = 0;
export const sessionGeneration = () => generation;
export const advanceSession = () => ++generation;
