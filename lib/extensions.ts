import { Extensions } from '@/types/appwrite';
import { createExtension, updateExtension, listExtensions, getCurrentUser } from '@/lib/appwrite';

export interface ExtensionHook {
  name: string;
  description: string;
  parameters: string[];
  returns: string;
}

export const availableHooks: ExtensionHook[] = [
  {
    name: 'onCreate',
    description: 'Triggered when a new note is created',
    parameters: ['note', 'settings'],
    returns: 'Modified note object'
  },
  {
    name: 'onUpdate',
    description: 'Triggered when a note is updated',
    parameters: ['note', 'oldNote', 'settings'],
    returns: 'Modified note object'
  },
  {
    name: 'onDelete',
    description: 'Triggered before a note is deleted',
    parameters: ['note', 'settings'],
    returns: 'Boolean (allow deletion)'
  },
  {
    name: 'onView',
    description: 'Triggered when a note is viewed/opened',
    parameters: ['note', 'settings'],
    returns: 'Modified note object'
  },
  {
    name: 'onShare',
    description: 'Triggered when a note is shared',
    parameters: ['note', 'shareSettings', 'settings'],
    returns: 'Modified note object'
  }
];

export interface ExtensionSettings {
  [key: string]: any;
}

export class ExtensionManager {
  private static instance: ExtensionManager;
  private extensions: Map<string, Extensions> = new Map();
  private enabledExtensions: Extensions[] = [];

  static getInstance(): ExtensionManager {
    if (!ExtensionManager.instance) {
      ExtensionManager.instance = new ExtensionManager();
    }
    return ExtensionManager.instance;
  }

  async initialize() {
    await this.loadExtensions();
  }

  async loadExtensions() {
    try {
      const result = await listExtensions();
      const extensions = result.documents as unknown as Extensions[];
      
      this.extensions.clear();
      this.enabledExtensions = [];
      
      extensions.forEach(ext => {
        this.extensions.set(ext.$id!, ext);
        if (ext.enabled) {
          this.enabledExtensions.push(ext);
        }
      });
    } catch (error: any) {
      console.error('Failed to load extensions:', error);
    }
  }

  async executeHook(hookName: string, data: any, additionalParams?: any): Promise<any> {
    const applicableExtensions = this.enabledExtensions.filter(ext => {
      const settings = ext.settings ? JSON.parse(ext.settings) : {};
      return settings.hooks && settings.hooks.includes(hookName);
    });

    let result = data;
    
    for (const extension of applicableExtensions) {
      try {
        result = await this.executeExtensionHook(extension, hookName, result, additionalParams);
      } catch (error: any) {
        console.error(`Extension ${extension.name} hook ${hookName} failed:`, error);
        // Continue with other extensions even if one fails
      }
    }

    return result;
  }

  private async executeExtensionHook(extension: Extensions, hookName: string, data: any, additionalParams?: any): Promise<any> {
    const settings = extension.settings ? JSON.parse(extension.settings) : {};
    
    // This is a simplified execution - in a real implementation, you'd want to:
    // 1. Safely sandbox the extension code
    // 2. Use a proper JavaScript runtime like VM2 or Web Workers
    // 3. Implement proper error handling and timeouts
    
    console.log(`Executing ${extension.name} hook: ${hookName}`, { data, settings, additionalParams });
    
    // For demo purposes, simulate some common extension behaviors
    switch (extension.name) {
      case 'AI Note Revisor':
        if (hookName === 'onCreate' && settings.autoApply) {
          return {
            ...data,
            content: `[AI Revised] ${data.content}`,
            metadata: JSON.stringify({
              ...JSON.parse(data.metadata || '{}'),
              revisedBy: 'AI Note Revisor'
            })
          };
        }
        break;
        
      case 'Smart Auto-Tagger':
        if (hookName === 'onCreate' || hookName === 'onUpdate') {
          const autoTags = this.extractTags(data.content);
          return {
            ...data,
            tags: [...(data.tags || []), ...autoTags].slice(0, settings.maxTags || 5)
          };
        }
        break;
        
      case 'Security Scanner':
        if (hookName === 'onCreate' || hookName === 'onUpdate') {
          const hasSensitiveData = this.scanForSensitiveData(data.content);
          if (hasSensitiveData && settings.autoEncrypt) {
            return {
              ...data,
              content: `[ENCRYPTED] ${data.content}`,
              metadata: JSON.stringify({
                ...JSON.parse(data.metadata || '{}'),
                securityScanned: true,
                encrypted: true
              })
            };
          }
        }
        break;
    }
    
    return data;
  }

  private extractTags(content: string): string[] {
    // Simple tag extraction - in reality this would use NLP/AI
    const words = content.toLowerCase().split(/\s+/);
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    
    return words
      .filter(word => word.length > 3 && !commonWords.includes(word))
      .slice(0, 3)
      .map(word => `auto:${word}`);
  }

  private scanForSensitiveData(content: string): boolean {
    const sensitivePatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
      /\b[A-Za-z0-9]{32,}\b/, // API keys
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(content));
  }

  async installExtension(extensionId: string): Promise<boolean> {
    try {
      await updateExtension(extensionId, { enabled: true });
      await this.loadExtensions();
      return true;
    } catch (error: any) {
      console.error('Failed to install extension:', error);
      return false;
    }
  }

  async uninstallExtension(extensionId: string): Promise<boolean> {
    try {
      await updateExtension(extensionId, { enabled: false });
      await this.loadExtensions();
      return true;
    } catch (error: any) {
      console.error('Failed to uninstall extension:', error);
      return false;
    }
  }

  async createExtensionFromTemplate(template: any): Promise<string | null> {
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      const extensionData = {
        name: template.name,
        description: template.description,
        version: '1.0.0',
        authorId: user.$id,
        enabled: false,
        settings: JSON.stringify({
          ...template.settings,
          hooks: template.hooks,
          code: template.code
        })
      };

      const result = await createExtension(extensionData);
      await this.loadExtensions();
      return result.$id;
    } catch (error: any) {
      console.error('Failed to create extension from template:', error);
      return null;
    }
  }

  getExtension(extensionId: string): Extensions | undefined {
    return this.extensions.get(extensionId);
  }

  getEnabledExtensions(): Extensions[] {
    return [...this.enabledExtensions];
  }

  getAllExtensions(): Extensions[] {
    return Array.from(this.extensions.values());
  }
}

// Global extension manager instance
export const extensionManager = ExtensionManager.getInstance();

// Hook functions that can be called from the notes system
export async function executeOnCreateHook(note: any): Promise<any> {
  return extensionManager.executeHook('onCreate', note);
}

export async function executeOnUpdateHook(note: any, oldNote: any): Promise<any> {
  return extensionManager.executeHook('onUpdate', note, { oldNote });
}

export async function executeOnDeleteHook(note: any): Promise<boolean> {
  const result = await extensionManager.executeHook('onDelete', note);
  return result !== false; // Allow deletion unless explicitly blocked
}

export async function executeOnViewHook(note: any): Promise<any> {
  return extensionManager.executeHook('onView', note);
}

export async function executeOnShareHook(note: any, shareSettings: any): Promise<any> {
  return extensionManager.executeHook('onShare', note, { shareSettings });
}