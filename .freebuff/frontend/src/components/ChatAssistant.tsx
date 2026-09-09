import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Check, Copy, Loader2, Mic, RotateCcw, Sparkles, Square, Trash2, Volume2, VolumeX, X } from 'lucide-react'
import { useT } from '@/i18n'
import { useAuth } from '@/auth/AuthContext'
import { assistantApi } from '@/api/endpoints'
import type { ChatMessage } from '@/api/endpoints'

const STORAGE_KEY = 'saksham_chat_history'

/* --------------------------------------------------- minimal Web Speech typings */
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }>> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function getSpeechLang(lang: string): string {
  const map: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN', mr: 'mr-IN', bn: 'bn-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN' }
  return map[lang] ?? 'en-IN'
}

/* ------------------------------------------------------------- markdown-lite */
/** Renders a safe subset: **bold**, `code`, links, and line/dash lists. No HTML injection. */
function MarkdownLite({ text }: { text: string }) {
  const nodes = useMemo(() => {
    const out: React.ReactNode[] = []
    const lines = text.split('\n')
    lines.forEach((line, i) => {
      const trimmed = line.trim()
      const isList = /^([-•]|\d+[.)])\s+/.test(trimmed)
      const content = isList ? trimmed.replace(/^([-•]|\d+[.)])\s+/, '') : trimmed
      // Tokenize bold / code / links on the (possibly list-stripped) content
      const parts: React.ReactNode[] = []
      const regex = /(\*\*[^*]+\*\*|`[^`]+`|\bhttps?:\/\/[^\s)]+)/g
      let last = 0
      let m: RegExpExecArray | null
      while ((m = regex.exec(content)) !== null) {
        if (m.index > last) parts.push(content.slice(last, m.index))
        const token = m[0]
        if (token.startsWith('**')) {
          parts.push(<strong key={`${i}-${m.index}`}>{token.slice(2, -2)}</strong>)
        } else if (token.startsWith('`')) {
          parts.push(<code key={`${i}-${m.index}`}>{token.slice(1, -1)}</code>)
        } else {
          parts.push(
            <a key={`${i}-${m.index}`} href={token} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted">
              {token}
            </a>,
          )
        }
        last = m.index + token.length
      }
      if (last < content.length) parts.push(content.slice(last))
      out.push(
        isList ? (
          <span key={i} className="flex gap-1.5">
            <span aria-hidden="true">•</span>
            <span>{parts}</span>
          </span>
        ) : (
          <span key={i}>{parts.length > 0 ? parts : '\u00A0'}</span>
        ),
      )
    })
    return out
  }, [text])

  return <div className="chat-md space-y-1 break-words">{nodes}</div>
}

function loadHistory(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatMessage[]
    return Array.isArray(parsed) ? parsed.slice(-40) : []
  } catch {
    return []
  }
}

export default function ChatAssistant() {
  const { t, lang } = useT()
  const { user } = useAuth()

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [speakingId, setSpeakingId] = useState<number | null>(null)
  const [listening, setListening] = useState(false)
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const busyRef = useRef(false)
  const recogRef = useRef<SpeechRecognitionLike | null>(null)
  const sendRef = useRef<(text: string) => void>(() => undefined)
  const ttsRef = useRef(false)
  ttsRef.current = ttsEnabled

  const sttSupported = useMemo(() => getSpeechRecognition() !== null, [])
  const ttsSupported = useMemo(() => typeof window !== 'undefined' && 'speechSynthesis' in window, [])

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)))
  }, [messages])

  useEffect(() => {
    if (open) {
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
      inputRef.current?.focus()
    }
  }, [open, messages, busy])

  // Stop any ongoing speech when the widget closes or unmounts
  useEffect(() => {
    if (!open && ttsSupported) window.speechSynthesis.cancel()
    return () => {
      if (ttsSupported) window.speechSynthesis.cancel()
    }
  }, [open, ttsSupported])

  const speak = useCallback(
    (id: number, text: string) => {
      if (!ttsSupported) return
      window.speechSynthesis.cancel()
      // Strip markdown tokens for a natural reading voice
      const plain = text.replace(/\*\*/g, '').replace(/`/g, '')
      const utter = new SpeechSynthesisUtterance(plain)
      utter.lang = getSpeechLang(lang)
      utter.onend = () => setSpeakingId((cur) => (cur === id ? null : cur))
      utter.onerror = () => setSpeakingId(null)
      setSpeakingId(id)
      window.speechSynthesis.speak(utter)
    },
    [ttsSupported, lang],
  )

  const stopSpeaking = useCallback(() => {
    if (ttsSupported) window.speechSynthesis.cancel()
    setSpeakingId(null)
  }, [ttsSupported])

  const send = useCallback(
    async (text: string) => {
      const message = text.trim()
      if (!message || busyRef.current) return
      busyRef.current = true
      setBusy(true)
      setError(null)
      if (ttsRef.current) window.speechSynthesis?.cancel()
      const userMsg: ChatMessage = { id: Date.now(), role: 'user', content: message, created_at: Date.now() }
      const history = messages
        .filter((m) => !m.error)
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }))
      setMessages((prev) => [...prev.slice(-40), userMsg])
      setInput('')
      try {
        const res = await assistantApi.chat(message, history)
        const aiMsg: ChatMessage = { id: Date.now() + 1, role: 'assistant', content: res.reply, created_at: Date.now() }
        setMessages((prev) => [...prev, aiMsg])
        setSuggestions(res.suggestions ?? [])
        if (ttsRef.current) speak(aiMsg.id, res.reply)
      } catch (err) {
        const msg = err instanceof Error ? err.message : t('err.generic')
        setError(msg)
        setMessages((prev) => [...prev, { id: Date.now() + 2, role: 'assistant', content: msg, created_at: Date.now(), error: true }])
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, t],
  )

  sendRef.current = (text) => void send(text)

  const clear = useCallback(() => {
    stopSpeaking()
    setMessages([])
    setSuggestions([])
    setError(null)
  }, [stopSpeaking])

  const copy = useCallback(async (m: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(m.content)
      setCopiedId(m.id)
      window.setTimeout(() => setCopiedId((cur) => (cur === m.id ? null : cur)), 1500)
    } catch {
      /* clipboard unavailable — silent, non-critical */
    }
  }, [])

  /* ------------------------------------------------------------- voice input */
  const stopListening = useCallback(() => {
    recogRef.current?.stop()
    setListening(false)
  }, [])

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognition()
    if (!Ctor) {
      setVoiceNotice(t('chat.voice.unsupported'))
      return
    }
    if (listening) {
      stopListening()
      return
    }
    setVoiceNotice(null)
    try {
      const recog = new Ctor()
      recog.lang = getSpeechLang(lang)
      recog.interimResults = true
      recog.continuous = false
      recog.onresult = (event) => {
        let transcript = ''
        let final = false
        for (let i = 0; i < event.results.length; i += 1) {
          transcript += event.results[i][0].transcript
          final = final || Boolean(event.results[i][0].isFinal)
        }
        setInput(transcript)
        if (final) window.setTimeout(() => sendRef.current(transcript), 0)
      }
      recog.onerror = (event) => {
        setListening(false)
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setVoiceNotice(t('chat.voice.denied'))
        } else if (event.error !== 'aborted') {
          setVoiceNotice(t('chat.voice.error'))
        }
      }
      recog.onend = () => setListening(false)
      recogRef.current = recog
      recog.start()
      setListening(true)
    } catch {
      setListening(false)
      setVoiceNotice(t('chat.voice.unsupported'))
    }
  }, [listening, stopListening, t, lang])

  const time = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const empty = messages.length === 0
  const greeting = user ? t('chat.greeting.user', { name: user.full_name.split(' ')[0] }) : t('chat.greeting.guest')

  return (
    <>
      {/* Floating action button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? t('chat.close') : t('chat.open')}
        aria-expanded={open}
        className={`fixed right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-white shadow-lg shadow-brand-900/30 transition-all hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 md:right-6 ${
          open ? 'rotate-90' : ''
        }`}
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.25rem)' }}
      >
        {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Bot className="h-6 w-6" aria-hidden="true" />}
      </button>

      {/* Chat window */}
      {open && (
        <div
          role="dialog"
          aria-label={t('chat.title')}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-24 sm:right-6 sm:max-h-[70vh] sm:w-[26rem] sm:rounded-2xl"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-brand-700 px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Sparkles className="h-5 w-5 text-saffron-300" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{t('chat.title')}</p>
                <p className="truncate text-[11px] text-brand-100">{t('chat.subtitle')}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {ttsSupported && (
                <button
                  type="button"
                  onClick={() => {
                    if (ttsEnabled) stopSpeaking()
                    setTtsEnabled((v) => !v)
                  }}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                    ttsEnabled ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                  aria-pressed={ttsEnabled}
                  aria-label={ttsEnabled ? t('chat.tts.off') : t('chat.tts.on')}
                  title={ttsEnabled ? t('chat.tts.off') : t('chat.tts.on')}
                >
                  {ttsEnabled ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
                </button>
              )}
              <button
                type="button"
                onClick={clear}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
                aria-label={t('chat.clear')}
                title={t('chat.clear')}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white sm:hidden"
                aria-label={t('chat.close')}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4" aria-live="polite">
            {empty ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
                  <Bot className="h-6 w-6" aria-hidden="true" />
                </span>
                <p className="max-w-[16rem] text-sm leading-relaxed text-slate-600">{greeting}</p>
                <div className="flex flex-col gap-1.5 pt-1">
                  {t('chat.seed.q1') !== 'chat.seed.q1' &&
                    [t('chat.seed.q1'), t('chat.seed.q2'), t('chat.seed.q3')].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void send(q)}
                        className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50"
                      >
                        {q}
                      </button>
                    ))}
                </div>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'rounded-br-md bg-brand-700 text-white'
                          : m.error
                            ? 'rounded-bl-md bg-red-50 text-red-700'
                            : 'rounded-bl-md border border-slate-100 bg-white text-slate-800'
                      }`}
                    >
                      {m.role === 'user' ? <p className="whitespace-pre-wrap break-words">{m.content}</p> : <MarkdownLite text={m.content} />}
                      <div className={`mt-1 flex items-center gap-2 ${m.role === 'user' ? 'text-brand-200' : 'text-slate-400'}`}>
                        <span className="text-[10px]">{time(m.created_at)}</span>
                        {m.role === 'assistant' && !m.error && (
                          <>
                            <button
                              type="button"
                              onClick={() => void copy(m)}
                              className="inline-flex items-center gap-0.5 text-[10px] hover:text-brand-700"
                              aria-label={t('chat.copy')}
                            >
                              {copiedId === m.id ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
                              {copiedId === m.id ? t('chat.copied') : t('chat.copy')}
                            </button>
                            {ttsSupported && (
                              <button
                                type="button"
                                onClick={() => (speakingId === m.id ? stopSpeaking() : speak(m.id, m.content))}
                                className="inline-flex items-center gap-0.5 text-[10px] hover:text-brand-700"
                                aria-label={speakingId === m.id ? t('chat.tts.stop') : t('chat.tts.on')}
                              >
                                {speakingId === m.id ? <Square className="h-3 w-3" aria-hidden="true" /> : <Volume2 className="h-3 w-3" aria-hidden="true" />}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}

            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-100 bg-white px-3.5 py-2.5 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-brand-600" aria-hidden="true" />
                  {t('chat.typing')}
                </div>
              </div>
            )}

            {/* Suggested follow-ups */}
            {!empty && !busy && suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Retry after error */}
            {error && !busy && (
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
                    if (lastUser) void send(lastUser.content)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('common.retry')}
                </button>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            className="border-t border-slate-100 bg-white px-3 py-3"
            onSubmit={(e) => {
              e.preventDefault()
              void send(input)
            }}
          >
            {(voiceNotice || listening) && (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600" role="status">
                <span className="flex items-center gap-2">
                  {listening && <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" aria-hidden="true" />}
                  {listening ? t('chat.voice.listening') : voiceNotice}
                </span>
                {listening && (
                  <button type="button" onClick={stopListening} className="font-medium text-brand-700 hover:underline">
                    {t('chat.voice.stop')}
                  </button>
                )}
              </div>
            )}
            <div className="flex items-end gap-2">
              {sttSupported && (
                <button
                  type="button"
                  onClick={startListening}
                  disabled={busy}
                  className={`flex h-[2.75rem] w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                    listening ? 'border-red-300 bg-red-50 text-red-600' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  } disabled:opacity-50`}
                  aria-label={listening ? t('chat.voice.stop') : t('chat.voice.start')}
                  aria-pressed={listening}
                >
                  <Mic className={`h-4.5 w-4.5 ${listening ? 'animate-pulse' : ''}`} aria-hidden="true" />
                </button>
              )}
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send(input)
                  }
                }}
                rows={1}
                maxLength={1000}
                placeholder={t('chat.placeholder')}
                aria-label={t('chat.placeholder')}
                className="input max-h-28 min-h-[2.75rem] flex-1 resize-none py-2.5"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="btn-primary shrink-0 self-end px-3.5"
                aria-label={t('chat.send')}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Bot className="h-4 w-4" aria-hidden="true" />}
                <span className="hidden sm:inline">{t('chat.send')}</span>
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-slate-400">{t('chat.hint')}</p>
          </form>
        </div>
      )}
    </>
  )
}
