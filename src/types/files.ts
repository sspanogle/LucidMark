export interface FileMetadata {
  readonly path: string;
  readonly size: number;
  readonly lastModified: string;
}

export interface FileContent extends FileMetadata {
  readonly content: string;
}

export type FileWriteResult = FileMetadata;
