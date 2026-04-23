export async function waitForAvailableSlot(
  queue: Set<Promise<unknown>>,
  limit: number,
) {
  if (limit <= 0) {
    return;
  }

  while (queue.size >= limit) {
    await Promise.race(queue);
  }
}

export function trackConcurrentTask<T>(
  queue: Set<Promise<unknown>>,
  task: Promise<T>,
) {
  const trackedTask = task.finally(() => {
    queue.delete(trackedTask);
  });

  queue.add(trackedTask);
  return trackedTask;
}
