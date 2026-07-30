import { FAB_LAYOUT, KylrixApp } from '../design';

interface FabAction {
  id: string;
  title: string;
  description: string;
  href?: string;
  icon?: string;
  app?: KylrixApp;
  disabled?: boolean;
}

interface FabModel {
  size: typeof FAB_LAYOUT.size;
  bottomOffset: typeof FAB_LAYOUT.bottomOffset;
  actions: FabAction[];
}

