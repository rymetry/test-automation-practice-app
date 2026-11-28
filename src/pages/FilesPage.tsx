import { useEffect, useRef, useState, type DragEvent, type FormEvent, type JSX } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import type { UploadedFile } from '../types';
import { formatSize } from '../ui/format';
import { PageLayout, useDocumentTitle } from '../ui/PageLayout';

function hasDroppedDirectory(dataTransfer: DataTransfer | null): boolean {
  const items = dataTransfer?.items;
  if (!items) return false;
  for (const item of Array.from(items)) {
    const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
    if (entry?.isDirectory === true) {
      return true;
    }
  }
  return false;
}

/** Worker が動的生成する 2 種のダウンロードと、名前・サイズのみ保存するアップロード画面。 */
export function FilesPage(): JSX.Element | null {
  useDocumentTitle('Files');
  const { user: currentUser } = useAuth();
  const [files, setFiles] = useState<UploadedFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uploadingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    void api.files
      .list()
      .then(
        (result) => (result.status === 200 && Array.isArray(result.data) ? result.data : null),
        () => null,
      )
      .then((initial) => {
        if (cancelled) return;
        setFiles(initial ?? []);
        setLoadFailed(initial === null);
      });

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  if (files === null) return null;

  async function uploadFiles(targetFiles: File[]): Promise<boolean> {
    if (uploadingRef.current || targetFiles.length === 0) return false;
    uploadingRef.current = true;
    setUploading(true);
    setError(null);

    let allSucceeded = true;
    try {
      for (const file of targetFiles) {
        try {
          const result = await api.files.upload(file);
          if (!mountedRef.current) return false;
          if (result.status === 201 && result.data && 'id' in result.data) {
            const uploaded = result.data;
            setFiles((current) => (current ? [...current, uploaded] : [uploaded]));
          } else {
            allSucceeded = false;
            setError('Could not upload the file');
          }
        } catch {
          if (!mountedRef.current) return false;
          allSucceeded = false;
          setError('Could not upload the file');
        }
      }
      return allSucceeded;
    } finally {
      uploadingRef.current = false;
      if (mountedRef.current) {
        setUploading(false);
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (uploadingRef.current) return;
    const input = inputRef.current;
    const file = input?.files?.[0];
    if (!file) {
      setError('Choose a file first');
      return;
    }

    const ok = await uploadFiles([file]);
    if (ok && mountedRef.current && input) {
      input.value = '';
    }
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    if (uploadingRef.current) {
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'none';
      }
      setIsDragging(false);
      return;
    }
    setIsDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    if (uploadingRef.current) {
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'none';
      }
      setIsDragging(false);
      return;
    }
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>): void {
    const related = event.relatedTarget;
    if (related instanceof Node && event.currentTarget.contains(related)) {
      return;
    }
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDragging(false);
    if (uploadingRef.current) return;

    // DataTransfer の内容はイベントハンドラ終了後に破棄されるため同期的に退避する。
    const droppedFiles = Array.from(event.dataTransfer?.files ?? []);
    if (hasDroppedDirectory(event.dataTransfer)) {
      setError('Could not upload the file');
      return;
    }
    if (droppedFiles.length === 0) {
      setError('No file was dropped');
      return;
    }

    void uploadFiles(droppedFiles);
  }

  async function handleDelete(id: number): Promise<void> {
    const result = await api.files.remove(id);
    if (!mountedRef.current) return;
    if (result.status === 204) {
      setFiles((current) => (current ? current.filter((file) => file.id !== id) : current));
    }
  }

  return (
    <PageLayout
      title="Files"
      intro="ダウンロードは Worker がその場で生成します。請求書 PDF はサインインが必要です（未サインインだと 401）。アップロードしたファイルは名前とサイズだけが保存され、中身は捨てられます。"
      size="medium"
    >
      <section className="card" aria-labelledby="downloads-title">
        <h2 id="downloads-title">Downloads</h2>
        <ul className="stack stack-wide" style={{ listStyle: 'none', padding: 0, gap: 'var(--space-2)' }}>
          <li>
            <a href="/api/files/invoice.pdf" download="invoice.pdf" data-testid="download-invoice">
              Download invoice (PDF)
            </a>
            {currentUser ? null : (
              <>
                {' '}
                <span className="muted">（サインインしていないので 401 になります）</span>
              </>
            )}
          </li>
          <li>
            <a href="/api/contacts.csv" download="contacts.csv" data-testid="download-contacts">
              Download contacts (CSV)
            </a>
          </li>
        </ul>
      </section>

      <section className="card" aria-labelledby="upload-title">
        <h2 id="upload-title">Upload</h2>
        <form className="row" data-testid="upload-form" onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="upload">Upload a file</label>
          <input ref={inputRef} id="upload" name="file" type="file" data-testid="upload-input" />
          <button type="submit" data-testid="upload" disabled={uploading}>
            Upload
          </button>
        </form>
        <div
          role="group"
          aria-label="File drop zone"
          className={isDragging ? 'dropzone is-over' : 'dropzone'}
          data-testid="upload-dropzone"
          data-dragging={isDragging ? 'true' : 'false'}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <p className="dropzone-title">Drop files here to upload</p>
          <p className="muted dropzone-hint">ファイルをドラッグ＆ドロップしてアップロードできます（複数ファイル可）。</p>
        </div>
        <div data-testid="upload-error">
          {error ? (
            <p role="alert" className="error">
              {error}
            </p>
          ) : null}
        </div>
        <h3 id="uploaded-title">Uploaded files</h3>
        {loadFailed ? (
          <p role="alert" className="error" data-testid="files-load-error">
            Could not load uploaded files
          </p>
        ) : null}
        <ul aria-labelledby="uploaded-title" className="todo-list" data-testid="uploaded-files" hidden={files.length === 0}>
          {files.map((file) => (
            <li key={file.id} data-testid="uploaded-file">
              <span>
                {file.name} <span className="muted">({formatSize(file.size)})</span>
              </span>
              <button type="button" className="btn-sm" onClick={() => void handleDelete(file.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
        <p className="muted" data-testid="no-files" hidden={files.length > 0 || loadFailed}>
          No files uploaded yet
        </p>
      </section>
    </PageLayout>
  );
}
