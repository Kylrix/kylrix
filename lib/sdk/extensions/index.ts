interface ExtensionManifest {
  id: string;
  name: string;
  description: string;
  scope: 'note' | 'flow' | 'connect' | 'vault';
}


export {};
