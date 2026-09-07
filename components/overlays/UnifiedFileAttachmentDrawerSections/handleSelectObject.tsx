'use client';


export function handleSelectObject(bag: any) {
  const {
  CurrentSubTabIcon,
  activeSubTab,
  activeTab,
  filteredMedia,
  filteredObjects,
  getSubTabIcon,
  handleAttachBatchMedia,
  handleFileUpload,
  handleSelectObject,
  isFullscreen,
  isPro,
  loadLocalObjects,
  loadSyncedMedia,
  loading,
  mediaFiles,
  objectItems,
  previewFile,
  renderFileIcon,
  s,
  searchQuery,
  selectedFile,
  selectedMediaIds,
  setActiveSubTab,
  setActiveTab,
  setIsFullscreen,
  setLoading,
  setMediaFiles,
  setObjectItems,
  setPreviewFile,
  setSearchQuery,
  setSelectedFile,
  setSelectedMediaIds,
  setUploading,
  setZoomScale,
  toggleMediaSelection,
  uploading,
  userId,
  zoomScale
  } = bag as any;

    if (
      (activeSubTab === 'totps' || activeSubTab === 'vault') &&
      !isUnlocked
    ) {
      const ok = await promptSudo('unlock');
      if (!ok) return;
    }

    const isEncrypted = item.isEncrypted || item.encrypted || item.locked;
    const itemTitle = isEncrypted
      ? 'Encrypted Item'
      : item.title || item.name || item.label || 'Attached Item';

    const childId = item.$id || item.id || 'obj';
    let childKind: any = 'note';
    if (activeSubTab === 'ideas') childKind = 'note';
    else if (activeSubTab === 'goals') childKind = 'task';
    else if (activeSubTab === 'projects') childKind = 'note';
    else if (activeSubTab === 'threads') childKind = 'note';
    else if (activeSubTab === 'totps') childKind = 'vault';
    else if (activeSubTab === 'vault') childKind = 'vault';
    else if (activeSubTab === 'forms') childKind = 'form';
    else if (activeSubTab === 'sessions') {
      const ok = window.confirm(
        'Attaching a Kylie session makes the entire conversation visible to anyone who can see this note. Continue?');
      if (!ok) return;
      childKind = 'session';
    }

    const objectBlock = serializeObjectBlock({
      childId,
      childKind,
      bucketId: activeSubTab,
      label: itemTitle,
      appTheme: 'idea',
      metadata: { title: itemTitle, subTab: activeSubTab }});

    options.onSelectFile({
      $id: childId,
      name: itemTitle,
      bucketId: activeSubTab,
      sizeOriginal: 0,
      mimeType: 'application/x-kylrix-object',
      fileUrl: objectBlock});
    closeFileDrawer();
}
