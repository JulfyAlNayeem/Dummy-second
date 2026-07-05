// @ts-nocheck

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { useCreateNoteMutation, useUpdateNoteMutation } from '@/redux/api/noteApi';

const NoteModal = ({
  open,
  selectedText,
  classId,
  messageId,
  noteId,
  mode = 'create',
  initialTitle = '',
  initialDescription = '',
  onSave,
  onClose,
}: any): JSX.Element => {
  const [title, setTitle] = useState(initialTitle || selectedText || '');
  const [description, setDescription] = useState(initialDescription || '');
  const [createNote, { isLoading: isCreating }] = useCreateNoteMutation();
  const [updateNote, { isLoading: isUpdating }] = useUpdateNoteMutation();
  const isSaving = isCreating || isUpdating;

  useEffect(() => {
    if (!open) return;
    setTitle(mode === 'edit' ? initialTitle || '' : selectedText || '');
    setDescription(mode === 'edit' ? initialDescription || '' : '');
  }, [open, mode, initialTitle, initialDescription, selectedText]);

  const handleSave = async () => {
    const trimmedTitle = title?.trim();
    if (!trimmedTitle) return;

    try {
      if (mode === 'edit' && noteId) {
        await updateNote({ noteId, classId, title: trimmedTitle, description }).unwrap();
        toast.success('Note updated successfully');
      } else {
        await createNote({ classId, title: trimmedTitle, description, messageId }).unwrap();
        toast.success('Note created successfully');
      }

      onSave?.(trimmedTitle, description);
      setTitle('');
      setDescription('');
      onClose();
    } catch (error) {
      console.error('Failed to save note:', error);
      toast.error('Failed to save note');
    }
  };

  const handleCancel = () => {
    setTitle('');
    setDescription('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent className="bg-gray-900/95 backdrop-blur-lg text-white border-gray-700">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit Note' : 'Add Note'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter note title"
              className="w-full bg-gray-800/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add your note description..."
              className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
              rows={4}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !title?.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Add Note'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NoteModal;
