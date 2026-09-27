type TaskRecord = Record<string, unknown>

/** HIA API keys stay server-side: task list/detail responses only expose whether one exists. */
export function sanitizeScheduledTask<T extends TaskRecord>(task: T): T & { has_hia_api_key?: boolean } {
  if (task.task_type !== "hia_workflow") return task
  const storedValue = typeof task.workflow_id === "string" ? task.workflow_id.trim() : ""
  return {
    ...task,
    workflow_id: null,
    has_hia_api_key: !!storedValue && !/^HIA_API_KEY(?:_[A-Z0-9_]+)?$/.test(storedValue),
  }
}

export function sanitizeScheduledTasks(tasks: TaskRecord[]): TaskRecord[] {
  return tasks.map(sanitizeScheduledTask)
}
