/** A fresh six-digit seed — the shared "new random seed" idiom. */
export const randomSeed = () => Math.floor(Math.random() * 1000000);
