import { invoke } from '@tauri-apps/api/core';
import type { FileContent, FileMetadata, FileWriteResult } from '@shared-types/files';

const COMMANDS = {
  openDialog: 'open_file_dialog',
  read: 'read_file',
  write: 'write_file',
  saveDialog: 'save_file_dialog',
  recent: 'get_recent_files',
  addRecent: 'add_recent_file',
  removeRecent: 'remove_recent_file',
  clearRecents: 'clear_recent_files',
} as const;

type CommandKey = keyof typeof COMMANDS;

type CommandName = (typeof COMMANDS)[CommandKey];

type InvokeArgs = Record<string, unknown> | undefined;

async function callCommand<T>(command: CommandName, args?: InvokeArgs): Promise<T> {
  return invoke<T>(command, args);
}

export async function pickFile(): Promise<string | null> {
  return callCommand<string | null>(COMMANDS.openDialog);
}

export async function readFileContent(path: string): Promise<FileContent> {
  if (!path.trim()) {
    throw new Error('File path is required');
  }

  return callCommand<FileContent>(COMMANDS.read, { path });
}

export async function writeFileContent(path: string, content: string): Promise<FileWriteResult> {
  if (!path.trim()) {
    throw new Error('File path is required');
  }

  return callCommand<FileWriteResult>(COMMANDS.write, { path, content });
}

export async function saveFileAs(defaultName?: string): Promise<string | null> {
  return callCommand<string | null>(COMMANDS.saveDialog, { defaultName });
}

export async function listRecentFiles(): Promise<FileMetadata[]> {
  return callCommand<FileMetadata[]>(COMMANDS.recent);
}

export async function registerRecentFile(path: string): Promise<void> {
  if (!path.trim()) {
    throw new Error('File path is required');
  }

  await callCommand<void>(COMMANDS.addRecent, { path });
}

export async function removeRecentFile(path: string): Promise<void> {
  if (!path.trim()) {
    throw new Error('File path is required');
  }

  await callCommand<void>(COMMANDS.removeRecent, { path });
}

export async function clearRecentFiles(): Promise<void> {
  await callCommand<void>(COMMANDS.clearRecents);
}
