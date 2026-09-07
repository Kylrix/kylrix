'use client';


export function handleFileUpload(bag: any) {
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

    const file = e.target.files?.[0];
    if (!file) return;

    if (!isPro) {
      e.target.value = '';
      openProUpgrade('File upload');
      return;
    }

    setUploading(true);
    try {
      const bucket = 'notes_attachments';
      const uploaded = await StorageService.uploadFile(file, bucket);
      const childKind = file.type.startsWith('image/') ? 'image' : 'file';
      const fileUrl = StorageService.getFileView(uploaded.$id, bucket);

      const objectBlock = serializeObjectBlock({
        childId: uploaded.$id,
        childKind,
        bucketId: bucket,
        label: uploaded.name,
        appTheme: 'idea',
        metadata: { mimeType: uploaded.mimeType || file.type, fileName: uploaded.name, fileUrl }});

      const newMedia: SyncedMediaFile = {
        $id: uploaded.$id,
        name: uploaded.name,
        bucketId: bucket,
        sizeOriginal: uploaded.sizeOriginal || file.size,
        mimeType: uploaded.mimeType || file.type,
        createdAt: new Date().toISOString(),
        fileUrl: objectBlock};

      const updated = [newMedia, ...mediaFiles];
      setMediaFiles(updated);
      await LocalEngine.cacheSet(`f_user_media_${userId}`, updated);

      options.onSelectFile(newMedia);
      closeFileDrawer();
    } catch (err) {
      console.error('Failed to upload file:', err);
    } finally {
      setUploading(false);
    }
}
