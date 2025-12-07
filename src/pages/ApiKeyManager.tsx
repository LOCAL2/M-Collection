import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ApiKey {
  id: string;
  api_key: string;
  user_name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  usage_count: number;
}

interface Props {
  onClose: () => void;
  userName: string;
  userId: string;
}

export default function ApiKeyManager({ onClose, userName, userId }: Props) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [description, setDescription] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchApiKeys();
  }, [userName]);

  const fetchApiKeys = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_name', userName)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching API keys:', error);
    } else {
      setApiKeys(data || []);
    }
    setLoading(false);
  };

  const generateApiKey = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'mgal_';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const createApiKey = async () => {
    if (!description.trim()) return;
    
    setCreating(true);
    const newKey = generateApiKey();
    
    const { error } = await supabase
      .from('api_keys')
      .insert({
        api_key: newKey,
        user_id: userId,
        user_name: userName,
        description: description.trim(),
        is_active: true,
        usage_count: 0
      });

    if (error) {
      console.error('Error creating API key:', error);
      alert('Failed to create API key: ' + error.message);
    } else {
      setDescription('');
      setShowCreateForm(false);
      fetchApiKeys();
    }
    setCreating(false);
  };

  const toggleKeyStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) {
      console.error('Error updating API key:', error);
    } else {
      fetchApiKeys();
    }
  };

  const deleteApiKey = async (id: string) => {
    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting API key:', error);
    } else {
      setDeleteConfirm(null);
      fetchApiKeys();
    }
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">API Keys</h2>
            <p className="text-slate-400 text-sm mt-1">Manage your API keys for external access</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Create New Key Button/Form */}
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full mb-6 p-4 border-2 border-dashed border-slate-700 rounded-lg text-slate-400 hover:text-white hover:border-slate-500 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New API Key
            </button>
          ) : (
            <div className="mb-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
              <h3 className="text-white font-medium mb-3">Create New API Key</h3>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (e.g., My Discord Bot)"
                className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={createApiKey}
                  disabled={creating || !description.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? 'Creating...' : 'Create Key'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setDescription('');
                  }}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* API Keys List */}
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>No API keys yet</p>
              <p className="text-sm mt-1">Create one to start using the API</p>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className={`p-4 rounded-lg border ${
                    key.is_active 
                      ? 'bg-slate-800 border-slate-700' 
                      : 'bg-slate-800/50 border-slate-700/50 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-white font-medium">{key.description || 'Unnamed Key'}</span>
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          key.is_active 
                            ? 'bg-green-600/20 text-green-400' 
                            : 'bg-red-600/20 text-red-400'
                        }`}>
                          {key.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <code className="text-sm text-slate-400 bg-slate-900 px-2 py-1 rounded font-mono">
                          {key.api_key.substring(0, 15)}...
                        </code>
                        <button
                          onClick={() => copyToClipboard(key.api_key)}
                          className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
                        >
                          {copiedKey === key.api_key ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <div className="text-xs text-slate-500 space-y-1">
                        <p>Created: {formatDate(key.created_at)}</p>
                        <p>Used: {key.usage_count} times</p>
                        {key.last_used_at && <p>Last used: {formatDate(key.last_used_at)}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => toggleKeyStatus(key.id, key.is_active)}
                        className={`px-3 py-1.5 text-xs rounded transition-colors ${
                          key.is_active
                            ? 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30'
                            : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                        }`}
                      >
                        {key.is_active ? 'Disable' : 'Enable'}
                      </button>
                      {deleteConfirm === key.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => deleteApiKey(key.id)}
                            className="px-2 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1.5 text-xs bg-slate-700 text-white rounded hover:bg-slate-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(key.id)}
                          className="px-3 py-1.5 text-xs bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/50">
          <p className="text-xs text-slate-500 text-center">
            API keys are used to authenticate requests. Keep them secret!
          </p>
        </div>
      </div>
    </div>
  );
}
