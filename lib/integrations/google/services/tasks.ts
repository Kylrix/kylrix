export class GoogleTasksService {
  constructor(private readonly accessToken: string) {}

  private get headers() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async listTaskLists() {
    const res = await fetch('https://tasks.googleapis.com/v1/users/@me/lists', {
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to fetch task lists');
    return res.json();
  }

  async listTasks(listId: string) {
    const res = await fetch(`https://tasks.googleapis.com/v1/lists/${listId}/tasks?maxResults=100&showCompleted=true&showHidden=true`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  }

  async createTask(listId: string, title: string, notes?: string) {
    const res = await fetch(`https://tasks.googleapis.com/v1/lists/${listId}/tasks`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ title, notes }),
    });
    if (!res.ok) throw new Error('Failed to create task');
    return res.json();
  }

  async updateTask(listId: string, taskId: string, data: any) {
    const res = await fetch(`https://tasks.googleapis.com/v1/lists/${listId}/tasks/${taskId}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update task');
    return res.json();
  }

  async deleteTask(listId: string, taskId: string) {
    const res = await fetch(`https://tasks.googleapis.com/v1/lists/${listId}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to delete task');
    return true;
  }
}
