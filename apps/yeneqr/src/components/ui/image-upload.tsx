'use client';

import React, { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

export interface ImageUploadProps {
  /** Current image URL to display (from server/DB) */
  currentImage?: string | null;
  /** Callback when image is uploaded (receives URL) or removed (receives null) */
  onImageChange: (url: string | null) => void;
  /**
   * When deferUpload is true, onImageChange is called with the File object
   * cast to string (`file.name`) AND the raw File is exposed via onFileSelect.
   * The parent component is responsible for uploading the file at the right
   * time (e.g. after the entity has been created and has an ID).
   *
   * When deferUpload is false (default), the component uploads immediately
   * to uploadEndpoint and calls onImageChange with the returned URL.
   */
  deferUpload?: boolean;
  /** When deferUpload is true, this is called with the raw File (or null on remove) */
  onFileSelect?: (file: File | null) => void;
  /** Upload API endpoint — POST FormData { image, entity, entityId } */
  uploadEndpoint?: string;
  /** Entity type for upload: 'restaurant-logo' | 'restaurant-banner' | 'category' | 'avatar' | 'menu-item' */
  entity?: string;
  /** Entity ID for the upload */
  entityId?: string;
  /** Width in px */
  size?: number;
  /** Height in px (defaults to size) */
  height?: number;
  /** 'square' (rounded-lg) or 'circle' (rounded-full) */
  shape?: 'square' | 'circle';
  /** Accepted file types */
  accept?: string;
  /** Max file size in bytes */
  maxSize?: number;
  /** Label shown in the drop zone */
  label?: string;
  /** Additional class name */
  className?: string;
}

export function ImageUpload({
  currentImage,
  onImageChange,
  deferUpload = false,
  onFileSelect,
  uploadEndpoint = '/api/upload',
  entity = 'menu-item',
  entityId = '',
  size = 200,
  height,
  shape = 'square',
  accept = 'image/*',
  maxSize = 5 * 1024 * 1024,
  label = 'Click or drag & drop to upload',
  className = '',
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const displayImage = preview || currentImage;
  const actualHeight = height ?? size;

  const validateFile = useCallback(
    (file: File): boolean => {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return false;
      }
      if (file.size > maxSize) {
        const maxMB = Math.round(maxSize / (1024 * 1024));
        toast.error(`Image must be under ${maxMB}MB`);
        return false;
      }
      return true;
    },
    [maxSize]
  );

  const processFile = useCallback(
    (file: File) => {
      if (!validateFile(file)) return;

      // Show local preview
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Defer-upload mode: hand the File to the parent, don't upload yet.
      // The parent is responsible for uploading it later (e.g. after the
      // entity has been created and has an ID for the upload URL).
      if (deferUpload) {
        onFileSelect?.(file);
        // onImageChange gets the file name so the parent can track "has a pending image"
        onImageChange(file.name);
        toast.success('Image attached — will be uploaded when you save');
        return;
      }

      // Upload to server
      const doUpload = async () => {
        try {
          setUploading(true);
          const formData = new FormData();
          formData.append('image', file);
          formData.append('entity', entity);
          if (entityId) formData.append('entityId', entityId);

          const token = typeof window !== 'undefined' ? localStorage.getItem('yeneqr_token') : null;
          const res = await fetch(uploadEndpoint, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            const imageUrl = data.data?.imageUrl ?? null;
            onImageChange(imageUrl);
            if (imageUrl) {
              toast.success('Image uploaded successfully');
            } else {
              toast.error('Upload succeeded but no URL returned');
            }
          } else {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error || 'Failed to upload image');
            // Revert preview on failure
            setPreview(null);
          }
        } catch {
          toast.error('Failed to upload image');
          setPreview(null);
        } finally {
          setUploading(false);
        }
      };
      doUpload();
    },
    [validateFile, deferUpload, onFileSelect, onImageChange, entity, entityId, uploadEndpoint]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleRemove = () => {
    setPreview(null);
    onImageChange(null);
    if (deferUpload) onFileSelect?.(null);
  };

  const handleClickBrowse = () => {
    fileInputRef.current?.click();
  };

  const containerStyle: React.CSSProperties = {
    width: size,
    height: actualHeight,
  };

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-lg';

  return (
    <div className={`relative inline-block ${className}`} style={containerStyle}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />

      {displayImage ? (
        <div className={`relative group w-full h-full ${shapeClass} overflow-hidden`}>
          <img
            src={displayImage}
            alt="Uploaded image"
            className="w-full h-full object-cover"
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 text-xs"
              onClick={handleClickBrowse}
            >
              <Upload className="h-3 w-3 mr-1" />
              Change
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-7 text-xs"
              onClick={handleRemove}
            >
              <X className="h-3 w-3 mr-1" />
              Remove
            </Button>
          </div>
          {/* Uploading spinner */}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={handleClickBrowse}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full h-full flex items-center justify-center cursor-pointer border-2 border-dashed transition-colors ${shapeClass} ${
            dragOver
              ? 'border-primary/60 bg-primary/5'
              : 'border-muted-foreground/20 hover:border-primary/40 hover:bg-primary/5'
          }`}
        >
          <div className="text-center px-3">
            {uploading ? (
              <Loader2 className="mx-auto h-6 w-6 text-muted-foreground animate-spin" />
            ) : (
              <>
                <ImageIcon className="mx-auto h-6 w-6 text-muted-foreground/40" />
                <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">{label}</p>
                <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                  PNG, JPG, WebP up to {Math.round(maxSize / (1024 * 1024))}MB
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
