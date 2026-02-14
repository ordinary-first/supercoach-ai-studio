import { ToDoItem, UserProfile, GoalNode } from '../../types';

export class LocalStorageAdapter {
  private getStorageKey(userId: string, type: 'todos' | 'goals' | 'profile'): string {
    return `secretcoach_${type}_${userId}`;
  }

  // === User Profile Methods ===
  async saveUserProfile(userId: string, profile: UserProfile): Promise<void> {
    try {
      const key = this.getStorageKey(userId, 'profile');
      localStorage.setItem(key, JSON.stringify(profile));
    } catch (error) {
      console.error('Error saving user profile:', error);
      throw new Error('Failed to save user profile to local storage');
    }
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const key = this.getStorageKey(userId, 'profile');
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  // === Goal/Node Methods ===
  async saveGoals(userId: string, goals: GoalNode[]): Promise<void> {
    try {
      const key = this.getStorageKey(userId, 'goals');
      localStorage.setItem(key, JSON.stringify(goals));
    } catch (error) {
      console.error('Error saving goals:', error);
      throw new Error('Failed to save goals to local storage');
    }
  }

  async getGoals(userId: string): Promise<GoalNode[]> {
    try {
      const key = this.getStorageKey(userId, 'goals');
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting goals:', error);
      return [];
    }
  }

  // === ToDo Methods ===
  async getTodos(userId: string): Promise<ToDoItem[]> {
    try {
      const key = this.getStorageKey(userId, 'todos');
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting todos:', error);
      return [];
    }
  }

  async saveTodo(userId: string, todo: ToDoItem): Promise<void> {
    try {
      const todos = await this.getTodos(userId);
      const existingIndex = todos.findIndex((t) => t.id === todo.id);

      if (existingIndex >= 0) {
        // Update existing todo
        todos[existingIndex] = todo;
      } else {
        // Add new todo
        todos.push(todo);
      }

      const key = this.getStorageKey(userId, 'todos');
      localStorage.setItem(key, JSON.stringify(todos));
    } catch (error) {
      console.error('Error saving todo:', error);
      throw new Error('Failed to save todo to local storage');
    }
  }

  async saveTodos(userId: string, todos: ToDoItem[]): Promise<void> {
    try {
      const key = this.getStorageKey(userId, 'todos');
      localStorage.setItem(key, JSON.stringify(todos));
    } catch (error) {
      console.error('Error saving todos:', error);
      throw new Error('Failed to save todos to local storage');
    }
  }

  async deleteTodo(userId: string, todoId: string): Promise<void> {
    try {
      const todos = await this.getTodos(userId);
      const filteredTodos = todos.filter((t) => t.id !== todoId);

      const key = this.getStorageKey(userId, 'todos');
      localStorage.setItem(key, JSON.stringify(filteredTodos));
    } catch (error) {
      console.error('Error deleting todo:', error);
      throw new Error('Failed to delete todo from local storage');
    }
  }

  async updateTodo(userId: string, todoId: string, updates: Partial<ToDoItem>): Promise<void> {
    try {
      const todos = await this.getTodos(userId);
      const updatedTodos = todos.map((t) =>
        t.id === todoId ? { ...t, ...updates } : t
      );

      const key = this.getStorageKey(userId, 'todos');
      localStorage.setItem(key, JSON.stringify(updatedTodos));
    } catch (error) {
      console.error('Error updating todo:', error);
      throw new Error('Failed to update todo in local storage');
    }
  }

  // === Utility Methods ===
  async clearAllData(userId: string): Promise<void> {
    try {
      localStorage.removeItem(this.getStorageKey(userId, 'todos'));
      localStorage.removeItem(this.getStorageKey(userId, 'goals'));
      localStorage.removeItem(this.getStorageKey(userId, 'profile'));
    } catch (error) {
      console.error('Error clearing all data:', error);
      throw new Error('Failed to clear data from local storage');
    }
  }
}

// Export singleton instance
export const localStorageAdapter = new LocalStorageAdapter();
