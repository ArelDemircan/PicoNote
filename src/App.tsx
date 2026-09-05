import React, { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { invoke } from '@tauri-apps/api/core';
import { Plus, Bold, Italic, List, Heading1, Heading2, Trash2, Cloud, Settings, DownloadCloud, Smartphone, Power, RefreshCw, Download, FileText, Sun, Moon } from 'lucide-react';
import './App.css';

interface Note {
  id: string;
  title: string;
  body: string;
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isSyncEnabled, setIsSyncEnabled] = useState<boolean>(
    localStorage.getItem('sync_enabled') === 'true'
  );
  const [syncStatus, setSyncStatus] = useState('Auto-Sync Active');
  const [localIp, setLocalIp] = useState<string>('127.0.0.1');

  const [theme, setTheme] = useState<'dark' | 'light'>(
    (localStorage.getItem('app_theme') as 'dark' | 'light') || 'dark'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const notesRef = useRef<Note[]>([]);
  notesRef.current = notes;

  const loadNotes = async () => {
    try {
      const fetchedNotes = await invoke<Note[]>('get_notes');
      setNotes(fetchedNotes);
      if (fetchedNotes.length > 0) {
        if (!activeNoteId || !fetchedNotes.some(n => n.id === activeNoteId)) {
          setActiveNoteId(fetchedNotes[0].id);
          setTitle(fetchedNotes[0].title);
        }
      } else {
        setActiveNoteId(null);
        setTitle('');
      }
    } catch (err) {
      console.error('Failed to load notes:', err);
    }
  };

  const fetchLocalIp = async () => {
    try {
      const ip = await invoke<string>('get_local_ip');
      setLocalIp(ip);
    } catch (err) {
      console.error('Failed to fetch local IP:', err);
    }
  };

  useEffect(() => {
    loadNotes();
    fetchLocalIp();
  }, []);

  useEffect(() => {
    if (!isSyncEnabled) return;

    const autoSyncInterval = setInterval(async () => {
      try {
        await invoke<string>('sync_webdav', {
          config: {
            url: `http://127.0.0.1:8080/`,
            username: '',
            password: '',
          },
        });
        
        const updatedNotes = await invoke<Note[]>('get_notes');
        if (JSON.stringify(updatedNotes) !== JSON.stringify(notesRef.current)) {
          setNotes(updatedNotes);
          setSyncStatus('Auto-Synced!');
        } else {
          setSyncStatus('Synced (No changes)');
        }
      } catch (err) {
        setSyncStatus('Waiting for connection...');
      }
    }, 3000);

    return () => clearInterval(autoSyncInterval);
  }, [isSyncEnabled]);

  const activeNote = notes.find((n) => n.id === activeNoteId);

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (activeNoteId) {
        setNotes((prev) =>
          prev.map((n) => (n.id === activeNoteId ? { ...n, body: html } : n))
        );
        invoke('update_note', {
          id: activeNoteId,
          title: title,
          body: html,
        }).catch((err) => console.error('Failed to update note:', err));
      }
    },
  });

  useEffect(() => {
    if (activeNote && editor) {
      if (editor.getHTML() !== activeNote.body) {
        editor.commands.setContent(activeNote.body);
      }
      setTitle(activeNote.title);
    }
  }, [activeNoteId, notes]);

  const handleCreateNote = async () => {
    const newTitle = 'New Note';
    const newBody = '<p>Start typing...</p>';

    try {
      const newId = await invoke<string>('create_note', {
        title: newTitle,
        body: newBody,
      });

      const newNote: Note = { id: newId, title: newTitle, body: newBody };
      setNotes((prev) => [newNote, ...prev]);
      setActiveNoteId(newId);
      setTitle(newTitle);
      editor?.commands.setContent(newBody);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const handleDeleteNote = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await invoke('delete_note', { id });
      const updatedNotes = notes.filter((n) => n.id !== id);
      setNotes(updatedNotes);

      if (activeNoteId === id) {
        if (updatedNotes.length > 0) {
          setActiveNoteId(updatedNotes[0].id);
          setTitle(updatedNotes[0].title);
          editor?.commands.setContent(updatedNotes[0].body);
        } else {
          setActiveNoteId(null);
          setTitle('');
          editor?.commands.setContent('');
        }
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updatedTitle = e.target.value;
    setTitle(updatedTitle);

    if (activeNoteId) {
      setNotes((prev) =>
        prev.map((n) => (n.id === activeNoteId ? { ...n, title: updatedTitle } : n))
      );

      invoke('update_note', {
        id: activeNoteId,
        title: updatedTitle,
        body: editor ? editor.getHTML() : '',
      }).catch((err) => console.error('Failed to update title:', err));
    }
  };

  const toggleSync = () => {
    const nextState = !isSyncEnabled;
    setIsSyncEnabled(nextState);
    localStorage.setItem('sync_enabled', String(nextState));
    setSyncStatus(nextState ? 'Auto-Sync ON' : 'Auto-Sync OFF');
  };

  const handleSync = async () => {
    if (!isSyncEnabled) return;
    setSyncStatus('Syncing...');
    try {
      await invoke<string>('sync_webdav', {
        config: {
          url: `http://127.0.0.1:8080/`,
          username: '',
          password: '',
        },
      });
      setSyncStatus('Manually Synced!');
      await loadNotes();
    } catch (err: any) {
      setSyncStatus('Error: ' + err);
    }
  };

  const handleRestore = async () => {
    if (!isSyncEnabled) return;
    setSyncStatus('Restoring...');
    try {
      const res = await invoke<string>('restore_from_webdav', {
        config: {
          url: `http://127.0.0.1:8080/`,
          username: '',
          password: '',
        },
      });
      setSyncStatus(res);
      await loadNotes();
    } catch (err: any) {
      setSyncStatus('Error: ' + err);
    }
  };

  const stripHtml = (html: string) => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html || '';
    return tmp.textContent || tmp.innerText || '';
  };

  const saveFileViaRust = async (content: string, defaultName: string, extName: string, extension: string) => {
    try {
      const saved = await invoke<boolean>('save_file_dialog', {
        defaultName,
        content,
        extName,
        extension,
      });

      if (saved) {
        alert('File saved successfully!');
        setShowExportModal(false);
      }
    } catch (err) {
      alert('File save error: ' + err);
    }
  };

  const exportCurrentNoteTxt = () => {
    if (!activeNote) return;
    const plainText = `${activeNote.title}\n${'='.repeat(activeNote.title.length)}\n\n${stripHtml(activeNote.body)}`;
    saveFileViaRust(plainText, `${activeNote.title || 'note'}.txt`, 'Text File', 'txt');
  };

  const exportAllNotesJson = () => {
    const jsonStr = JSON.stringify(notes, null, 2);
    saveFileViaRust(jsonStr, `piconote_backup_${new Date().toISOString().slice(0,10)}.json`, 'JSON Backup File', 'json');
  };

  const exportAllNotesTxt = () => {
    let combined = `PicoNote All Notes (${new Date().toLocaleDateString()})\n========================================\n\n`;
    notes.forEach((n, i) => {
      combined += `${i + 1}. ${n.title}\n${'-'.repeat(n.title.length + 3)}\n${stripHtml(n.body)}\n\n----------------------------------------\n\n`;
    });
    saveFileViaRust(combined, `all_notes_${new Date().toISOString().slice(0,10)}.txt`, 'Text File', 'txt');
  };

  const webdavPhoneUrl = `http://${localIp}:8080/`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(webdavPhoneUrl)}`;

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="brand">PicoNote</span>
          <button className="add-btn" onClick={handleCreateNote}>
            <Plus size={16} /> New Note
          </button>
        </div>

        <ul className="note-list">
          {notes.map((note) => (
            <li
              key={note.id}
              className={`note-item ${note.id === activeNoteId ? 'active' : ''}`}
              onClick={() => {
                setActiveNoteId(note.id);
                setTitle(note.title);
              }}
            >
              <div className="note-title">{note.title || 'Untitled Note'}</div>
              <button
                className="delete-btn"
                title="Delete Note"
                onClick={(e) => handleDeleteNote(e, note.id)}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>

        <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
          <button
            className="toolbar-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{ padding: '8px 10px' }}
          >
            {theme === 'dark' ? <Sun size={16} color="#eab308" /> : <Moon size={16} color="#0284c7" />}
          </button>

          <button
            className="add-btn"
            style={{ flex: 1, justifyContent: 'center', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
            onClick={() => setShowExportModal(true)}
            title="Export Notes"
          >
            <Download size={16} /> Export
          </button>

          <button
            className="toolbar-btn"
            style={{ padding: '8px 10px' }}
            onClick={() => { fetchLocalIp(); setShowSettingsModal(true); }}
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        {activeNoteId ? (
          <>
            <div className="editor-toolbar">
              <button className="toolbar-btn" onClick={() => editor?.chain().focus().toggleBold().run()}>
                <Bold size={14} />
              </button>
              <button className="toolbar-btn" onClick={() => editor?.chain().focus().toggleItalic().run()}>
                <Italic size={14} />
              </button>
              <button className="toolbar-btn" onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
                <Heading1 size={14} />
              </button>
              <button className="toolbar-btn" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
                <Heading2 size={14} />
              </button>
              <button className="toolbar-btn" onClick={() => editor?.chain().focus().toggleBulletList().run()}>
                <List size={14} />
              </button>
            </div>

            <div className="editor-container">
              <input
                type="text"
                className="title-input"
                value={title}
                onChange={handleTitleChange}
                placeholder="Note Title..."
              />
              <EditorContent editor={editor} />
            </div>
          </>
        ) : (
          <div style={{ padding: '32px', color: 'var(--text-secondary)' }}>
            No note selected. Create a new note to start.
          </div>
        )}
      </main>

      {/* Export Modal */}
      {showExportModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-secondary)', padding: '24px', borderRadius: '8px',
            width: '360px', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '14px',
            border: '1px solid var(--border-color)'
          }}>
            <h3>Export Notes</h3>

            {activeNote && (
              <button className="add-btn" style={{ justifyContent: 'center', background: '#38bdf8', color: '#0f172a' }} onClick={exportCurrentNoteTxt}>
                <FileText size={16} /> Export Active Note (.TXT)
              </button>
            )}

            <button className="add-btn" style={{ justifyContent: 'center' }} onClick={exportAllNotesTxt}>
              <FileText size={16} /> Export All Notes (.TXT)
            </button>

            <button className="add-btn" style={{ justifyContent: 'center', background: '#22c55e', color: '#0f172a' }} onClick={exportAllNotesJson}>
              <Download size={16} /> Backup All Notes (.JSON)
            </button>

            <button
              className="toolbar-btn"
              style={{ padding: '8px', marginTop: '6px' }}
              onClick={() => setShowExportModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-secondary)', padding: '24px', borderRadius: '8px',
            width: '380px', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '16px',
            border: '1px solid var(--border-color)'
          }}>
            <h3>Mobile Sync Settings</h3>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-primary)', padding: '12px', borderRadius: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Power size={18} color={isSyncEnabled ? '#22c55e' : '#64748b'} />
                <span>Mobile Access</span>
              </div>
              <button
                onClick={toggleSync}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  background: isSyncEnabled ? '#22c55e' : '#ef4444',
                  color: 'white'
                }}
              >
                {isSyncEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {isSyncEnabled ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button className="add-btn" style={{ justifyContent: 'center' }} onClick={handleSync}>
                  <Cloud size={16} /> Sync Now (Merge)
                </button>
                <button
                  className="add-btn"
                  style={{ justifyContent: 'center', background: '#eab308', color: '#0f172a' }}
                  onClick={handleRestore}
                >
                  <DownloadCloud size={16} /> Restore Backup
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--accent-color)', fontSize: '0.8rem' }}>
                  <RefreshCw size={13} />
                  <span>Status: {syncStatus}</span>
                </div>

                <hr style={{ borderColor: 'var(--border-color)', margin: '2px 0' }} />

                <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px', color: 'var(--accent-color)' }}>
                    <Smartphone size={16} /> <b>Connect via Phone</b>
                  </div>

                  <div style={{ background: 'white', padding: '6px', borderRadius: '6px', display: 'inline-block' }}>
                    <img src={qrApiUrl} alt="QR Code" style={{ width: '130px', height: '130px', display: 'block' }} />
                  </div>
                  
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    Automatic background sync is active. You can also connect via: <br/>
                    <code style={{ color: 'var(--accent-color)' }}>{webdavPhoneUrl}</code>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '12px 0' }}>
                Mobile access is disabled.
              </div>
            )}

            <button
              className="toolbar-btn"
              style={{ padding: '8px', marginTop: '4px' }}
              onClick={() => setShowSettingsModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
