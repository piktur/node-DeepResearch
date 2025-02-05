export async function sleep(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  console.log(`Waiting ${seconds}s...`);
  return new Promise((resolve) => setTimeout(resolve, ms));
}
