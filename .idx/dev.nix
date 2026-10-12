{pkgs}: {
  channel = "stable-24.05";
  packages = [
    pkgs.nodejs_20
    pkgs.nodePackages.pnpm
    pkgs.openssh
  ];
  idx.extensions = [
    "svelte.svelte-vscode"
    "vue.volar"
  ];
}

