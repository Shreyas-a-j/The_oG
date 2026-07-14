import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL;

const authClient = axios.create({ baseURL: API_URL });

function App() {
  const [authMode, setAuthMode] = useState('login');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [me, setMe] = useState(null);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState('');
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [presence, setPresence] = useState({});
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [draft, setDraft] = useState('');
  const [newRoom, setNewRoom] = useState({ name: '', isPrivate: false, memberId: '' });
  const [error, setError] = useState('');
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const authedClient = useMemo(() => {
    return axios.create({
      baseURL: API_URL,
      headers: token ? { Authorization: ['Bearer', token].join(' ') } : {},
    });
  }, [token]);

  const activeRoom = rooms.find((room) => room._id === activeRoomId);

  useEffect(() => {
    if (!token) {
      return;
    }

    authedClient
      .get('/api/auth/me')
      .then((response) => setMe(response.data.user))
      .catch(() => {
        setToken('');
        localStorage.removeItem('token');
      });

    authedClient
      .get('/api/rooms')
      .then((response) => {
        setRooms(response.data.rooms);
        if (response.data.rooms[0]) {
          setActiveRoomId(response.data.rooms[0]._id);
        }
      })
      .catch(() => setError('Failed to load rooms'));
  }, [authedClient, token]);

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnectionState('disconnected');
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: {
        token,
      },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionState('connected');
    });

    socket.on('disconnect', () => {
      setConnectionState('disconnected');
    });

    socket.on('message:new', (message) => {
      if (message.room === activeRoomId) {
        setMessages((previous) => [...previous, message]);
      }
    });

    socket.on('typing:update', ({ roomId, userId, username, isTyping }) => {
      if (roomId !== activeRoomId) {
        return;
      }

      setTypingUsers((previous) => {
        if (isTyping) {
          if (previous.some((user) => user.userId === userId)) {
            return previous;
          }
          return [...previous, { userId, username }];
        }
        return previous.filter((user) => user.userId !== userId);
      });
    });

    socket.on('presence:update', ({ userId, isOnline }) => {
      setPresence((previous) => ({ ...previous, [userId]: isOnline }));
    });

    socket.on('connect_error', () => setError('Socket authentication failed'));

    return () => {
      socket.disconnect();
    };
  }, [activeRoomId, token]);

  useEffect(() => {
    if (!activeRoomId || !token) {
      return;
    }

    authedClient
      .get(`/api/messages/${activeRoomId}`)
      .then((response) => {
        setMessages(response.data.messages);
        setTypingUsers([]);
      })
      .catch(() => setError('Failed to load messages'));

    socketRef.current?.emit('room:join', { roomId: activeRoomId });
  }, [activeRoomId, authedClient, token]);

  const submitAuth = async (event) => {
    event.preventDefault();
    setError('');

    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload =
      authMode === 'login'
        ? { email: authForm.email, password: authForm.password }
        : authForm;

    try {
      const response = await authClient.post(endpoint, payload);
      const nextToken = response.data.token;
      localStorage.setItem('token', nextToken);
      setToken(nextToken);
      setAuthForm({ username: '', email: '', password: '' });
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Authentication failed');
    }
  };

  const createRoom = async (event) => {
    event.preventDefault();

    const memberIds = newRoom.memberId ? [newRoom.memberId.trim()] : [];

    try {
      const response = await authedClient.post('/api/rooms', {
        name: newRoom.name,
        isPrivate: newRoom.isPrivate,
        memberIds,
      });

      setRooms((previous) => [response.data.room, ...previous]);
      setActiveRoomId(response.data.room._id);
      setNewRoom({ name: '', isPrivate: false, memberId: '' });
    } catch {
      setError('Failed to create room');
    }
  };

  const sendMessage = (event) => {
    event.preventDefault();

    if (!draft.trim() || !activeRoomId || !socketRef.current) {
      return;
    }

    socketRef.current.emit('message:send', {
      roomId: activeRoomId,
      content: draft,
    });

    socketRef.current.emit('typing:stop', { roomId: activeRoomId });
    setDraft('');
  };

  const onType = (nextValue) => {
    setDraft(nextValue);

    if (!activeRoomId || !socketRef.current) {
      return;
    }

    socketRef.current.emit('typing:start', { roomId: activeRoomId });

    window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      socketRef.current?.emit('typing:stop', { roomId: activeRoomId });
    }, 900);
  };

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-900 p-6 text-slate-100">
        <section className="mx-auto max-w-md rounded-lg bg-slate-800 p-6 shadow">
          <h1 className="text-2xl font-semibold">Secure Chat</h1>
          <p className="mt-1 text-sm text-slate-300">Sign in or create an account.</p>
          <form className="mt-4 space-y-3" onSubmit={submitAuth}>
            {authMode === 'register' && (
              <input
                required
                className="w-full rounded bg-slate-700 p-2"
                placeholder="Username"
                value={authForm.username}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, username: event.target.value }))}
              />
            )}
            <input
              required
              type="email"
              className="w-full rounded bg-slate-700 p-2"
              placeholder="Email"
              value={authForm.email}
              onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
            />
            <input
              required
              minLength={6}
              type="password"
              className="w-full rounded bg-slate-700 p-2"
              placeholder="Password"
              value={authForm.password}
              onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
            />
            <button className="w-full rounded bg-indigo-500 p-2 font-medium" type="submit">
              {authMode === 'login' ? 'Login' : 'Register'}
            </button>
          </form>
          <button
            className="mt-3 text-sm text-indigo-300"
            type="button"
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
          >
            {authMode === 'login' ? 'Need an account? Register' : 'Have an account? Login'}
          </button>
          {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen grid-cols-1 gap-4 bg-slate-900 p-4 text-slate-100 md:grid-cols-[300px_1fr]">
      <aside className="rounded-lg bg-slate-800 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Rooms</h2>
          <span className={`text-xs ${connectionState === 'connected' ? 'text-emerald-400' : 'text-amber-300'}`}>
            {connectionState}
          </span>
        </div>

        <form className="mb-3 space-y-2" onSubmit={createRoom}>
          <input
            className="w-full rounded bg-slate-700 p-2 text-sm"
            placeholder="Room name"
            required
            value={newRoom.name}
            onChange={(event) => setNewRoom((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            className="w-full rounded bg-slate-700 p-2 text-sm"
            placeholder="DM member ID (optional)"
            value={newRoom.memberId}
            onChange={(event) => setNewRoom((prev) => ({ ...prev, memberId: event.target.value }))}
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={newRoom.isPrivate}
              onChange={(event) => setNewRoom((prev) => ({ ...prev, isPrivate: event.target.checked }))}
            />
            Private room (DM)
          </label>
          <button className="w-full rounded bg-indigo-500 p-2 text-sm" type="submit">
            Create room
          </button>
        </form>

        <ul className="space-y-2">
          {rooms.map((room) => (
            <li key={room._id}>
              <button
                type="button"
                className={`w-full rounded p-2 text-left text-sm ${
                  room._id === activeRoomId ? 'bg-slate-700' : 'bg-slate-900'
                }`}
                onClick={() => setActiveRoomId(room._id)}
              >
                <span>{room.name}</span>
                {room.isPrivate && <span className="ml-2 text-xs text-violet-300">DM</span>}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex flex-col rounded-lg bg-slate-800 p-4">
        <header className="mb-3 border-b border-slate-700 pb-3">
          <h1 className="text-xl font-semibold">{activeRoom?.name || 'Select a room'}</h1>
          <p className="text-xs text-slate-300">
            Signed in as {me?.username}. Members online:{' '}
            {activeRoom?.members?.filter((member) => presence[member._id] || member.isOnline).length || 0}
          </p>
        </header>

        <div className="mb-3 flex-1 space-y-2 overflow-y-auto rounded bg-slate-900 p-3">
          {messages.map((message) => (
            <article key={message._id} className="rounded bg-slate-800 p-2">
              <p className="text-xs text-indigo-300">{message.sender?.username || 'Unknown'}</p>
              <p className="text-sm">{message.content}</p>
            </article>
          ))}
          {messages.length === 0 && <p className="text-sm text-slate-400">No messages yet.</p>}
        </div>

        {typingUsers.length > 0 && (
          <p className="mb-2 text-xs text-amber-300">{typingUsers.map((user) => user.username).join(', ')} typing...</p>
        )}

        <form className="flex gap-2" onSubmit={sendMessage}>
          <input
            className="flex-1 rounded bg-slate-700 p-2"
            placeholder="Type a message"
            value={draft}
            onChange={(event) => onType(event.target.value)}
            disabled={!activeRoomId}
          />
          <button className="rounded bg-indigo-500 px-4" disabled={!activeRoomId} type="submit">
            Send
          </button>
        </form>

        {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      </section>
    </main>
  );
}

export default App;
