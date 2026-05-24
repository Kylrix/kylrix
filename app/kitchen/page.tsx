import React from 'react';
import fs from 'fs';
import path from 'path';
import KitchenPortalClient from './KitchenPortalClient';

interface TreeNode {
  name: string;
  route: string;
  isFolder: boolean;
  hasPage: boolean;
  children: TreeNode[];
}

function scanKitchen(dir: string, baseRoute = '/kitchen'): TreeNode[] {
  if (!fs.existsSync(dir)) return [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  const nodes: TreeNode[] = [];

  for (const item of items) {
    if (item.isDirectory()) {
      const fullPath = path.join(dir, item.name);
      const subRoute = `${baseRoute}/${item.name}`;
      const hasPage = fs.existsSync(path.join(fullPath, 'page.tsx'));
      const children = scanKitchen(fullPath, subRoute);

      if (hasPage || children.length > 0) {
        nodes.push({
          name: item.name,
          route: subRoute,
          isFolder: true,
          hasPage,
          children
        });
      }
    }
  }

  // Sort: folders with pages/children first, then alphabetically
  return nodes.sort((a, b) => a.name.localeCompare(b.name));
}

export default function KitchenPage() {
  const kitchenDir = path.join(process.cwd(), 'app/kitchen');
  const tree = scanKitchen(kitchenDir);

  return <KitchenPortalClient tree={tree} />;
}
