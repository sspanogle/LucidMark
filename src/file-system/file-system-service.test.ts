import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  listRecentFiles,
  pickFile,
  readFileContent,
  registerRecentFile,
  saveFileAs,
  writeFileContent,
} from '@file-system/file-system-service';
import type { FileContent, FileMetadata, FileWriteResult } from '@shared-types/files';

type InvokeHandler = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

const invokeMock = vi.fn<InvokeHandler>();

vi.mock('@tauri-apps/api/core', (): { invoke: InvokeHandler } => ({
  invoke: (command: string, args?: Record<string, unknown>) => invokeMock(command, args),
}));

describe('file-system-service', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('delegates to open file dialog command', async () => {
    invokeMock.mockResolvedValueOnce('/path/to/file.md');
    const path = await pickFile();

    expect(path).toBe('/path/to/file.md');
    expect(invokeMock).toHaveBeenCalledWith('open_file_dialog', undefined);
  });

  it('reads file content with validation', async () => {
    const response: FileContent = {
      path: '/file.md',
      size: 1024,
      lastModified: '2024-01-01T00:00:00.000Z',
      content: '# Document',
    };
    invokeMock.mockResolvedValueOnce(response);

    const result = await readFileContent('/file.md');

    expect(result).toEqual(response);
    expect(invokeMock).toHaveBeenCalledWith('read_file', { path: '/file.md' });
  });

  it('rejects blank paths when reading', async () => {
    await expect(readFileContent('   ')).rejects.toThrow('File path is required');
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('writes file content', async () => {
    const response: FileWriteResult = {
      path: '/file.md',
      size: 42,
      lastModified: '2024-01-01T00:00:00.000Z',
    };
    invokeMock.mockResolvedValueOnce(response);

    const result = await writeFileContent('/file.md', '# Data');

    expect(result).toEqual(response);
    expect(invokeMock).toHaveBeenCalledWith('write_file', {
      path: '/file.md',
      content: '# Data',
    });
  });

  it('looks up and registers recent files', async () => {
    const recent: FileMetadata[] = [
      { path: '/a.md', size: 10, lastModified: '2024-01-01T00:00:00.000Z' },
    ];
    invokeMock
      .mockResolvedValueOnce(recent)
      .mockResolvedValueOnce(undefined);

    const list = await listRecentFiles();
    expect(list).toEqual(recent);
    expect(invokeMock).toHaveBeenCalledWith('get_recent_files', undefined);

    await registerRecentFile('/a.md');
    expect(invokeMock).toHaveBeenLastCalledWith('add_recent_file', { path: '/a.md' });
  });

  it('opens save dialog with default name', async () => {
    invokeMock.mockResolvedValueOnce('/saved.md');
    const result = await saveFileAs('untitled.md');

    expect(result).toBe('/saved.md');
    expect(invokeMock).toHaveBeenCalledWith('save_file_dialog', { defaultName: 'untitled.md' });
  });
});
