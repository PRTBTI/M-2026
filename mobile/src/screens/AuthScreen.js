import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { darkColors as C, spacing, radius, textStyles } from '../theme';

export default function AuthScreen() {
  const { login, register, verifyAccount } = useApp();
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', nickname: '' });
  const [verifyToken, setVerifyToken] = useState('');
  const [status, setStatus] = useState('');
  const [generatedToken, setGeneratedToken] = useState('');
  const [busy, setBusy] = useState(false);

  function update(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function switchTab(t) {
    setTab(t);
    setStatus('');
    setGeneratedToken('');
  }

  async function handleLogin() {
    if (busy) return;
    setBusy(true);
    setStatus('');
    const res = await login(form.email.trim(), form.password);
    setBusy(false);
    if (res.error) setStatus(res.error);
  }

  async function handleRegister() {
    if (busy) return;
    setBusy(true);
    setStatus('');
    const res = await register({
      email: form.email.trim(),
      password: form.password,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      nickname: form.nickname.trim(),
    });
    setBusy(false);
    if (res.error) { setStatus(res.error); return; }
    setGeneratedToken(res.verificationToken);
    setStatus('Konto utworzone. Skopiuj token poniżej i użyj zakładki Weryfikacja.');
  }

  async function handleVerify() {
    if (busy || !verifyToken.trim()) return;
    setBusy(true);
    setStatus('');
    const res = await verifyAccount(verifyToken.trim());
    setBusy(false);
    if (res.error) setStatus(res.error);
    // on success, AppNavigator will switch to Main automatically
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* Brand */}
          <View style={s.brand}>
            <View style={s.brandMark} />
            <View>
              <Text style={s.brandWord}>KIPI</Text>
              <Text style={s.brandSub}>Mundial 2026 Typer</Text>
            </View>
          </View>

          {/* Terminal card */}
          <View style={s.card}>
            <View style={s.topbar}>
              {[C.orange, '#f6c15b', C.green].map((color, i) => (
                <View key={i} style={[s.dot, { backgroundColor: color }]} />
              ))}
            </View>

            <Text style={s.cardTitle}>Typer Access</Text>

            {/* Tabs */}
            <View style={s.tabs}>
              {['login', 'register', 'verify'].map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.tabBtn, tab === t && s.tabBtnActive]}
                  onPress={() => switchTab(t)}
                >
                  <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                    {t === 'login' ? 'Logowanie' : t === 'register' ? 'Rejestracja' : 'Weryfikacja'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Login */}
            {tab === 'login' && (
              <View style={s.form}>
                <Text style={s.label}>E-mail</Text>
                <View style={s.termRow}>
                  <Text style={s.prompt}>&gt;</Text>
                  <TextInput
                    style={s.termInput}
                    value={form.email}
                    onChangeText={v => update('email', v)}
                    placeholder="mail@firma.pl"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                </View>
                <Text style={s.label}>Hasło</Text>
                <View style={s.termRow}>
                  <Text style={s.prompt}>&gt;</Text>
                  <TextInput
                    style={s.termInput}
                    value={form.password}
                    onChangeText={v => update('password', v)}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    secureTextEntry
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                </View>
                {!!status && <Text style={s.statusText}>{status}</Text>}
                <TouchableOpacity style={[s.btn, busy && s.btnDisabled]} onPress={handleLogin} disabled={busy}>
                  <Text style={s.btnText}>{busy ? 'Logowanie…' : 'Zaloguj'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Register */}
            {tab === 'register' && (
              <View style={s.form}>
                <View style={s.row2}>
                  <View style={s.half}>
                    <Text style={s.label}>Imię</Text>
                    <TextInput style={s.input} value={form.firstName} onChangeText={v => update('firstName', v)} autoCapitalize="words" />
                  </View>
                  <View style={s.half}>
                    <Text style={s.label}>Nazwisko</Text>
                    <TextInput style={s.input} value={form.lastName} onChangeText={v => update('lastName', v)} autoCapitalize="words" />
                  </View>
                </View>
                <Text style={s.label}>E-mail</Text>
                <TextInput style={s.input} value={form.email} onChangeText={v => update('email', v)} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                <Text style={s.label}>Pseudonim (opcjonalnie)</Text>
                <TextInput style={s.input} value={form.nickname} onChangeText={v => update('nickname', v)} maxLength={32} />
                <Text style={s.label}>Hasło (min. 8 znaków)</Text>
                <TextInput style={s.input} value={form.password} onChangeText={v => update('password', v)} secureTextEntry />
                {!!status && <Text style={s.statusText}>{status}</Text>}
                {!!generatedToken && (
                  <View style={s.tokenBox}>
                    <Text style={s.tokenLabel}>Token weryfikacyjny</Text>
                    <Text style={s.tokenValue} selectable>{generatedToken}</Text>
                    <Text style={s.tokenNote}>
                      W produkcji token byłby wysłany mailem. Skopiuj go i użyj w zakładce Weryfikacja.
                    </Text>
                  </View>
                )}
                <TouchableOpacity style={[s.btn, busy && s.btnDisabled]} onPress={handleRegister} disabled={busy}>
                  <Text style={s.btnText}>{busy ? 'Rejestracja…' : 'Utwórz konto'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Verify */}
            {tab === 'verify' && (
              <View style={s.form}>
                <Text style={s.label}>Token weryfikacyjny</Text>
                <TextInput
                  style={s.input}
                  value={verifyToken}
                  onChangeText={setVerifyToken}
                  placeholder="Wklej token z rejestracji"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {!!status && <Text style={s.statusText}>{status}</Text>}
                <TouchableOpacity style={[s.btn, busy && s.btnDisabled]} onPress={handleVerify} disabled={busy}>
                  <Text style={s.btnText}>{busy ? 'Weryfikacja…' : 'Potwierdź konto'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  brandMark: {
    width: 44, height: 44, borderRadius: 8,
    backgroundColor: C.orange,
  },
  brandWord: { color: C.ink, fontSize: 26, fontWeight: '800', textTransform: 'uppercase' },
  brandSub: { color: C.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  card: {
    backgroundColor: '#1f1e1b',
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  topbar: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  dot: { width: 11, height: 11, borderRadius: 6 },
  cardTitle: { color: C.white, fontSize: 32, fontWeight: '800', textTransform: 'uppercase', marginBottom: spacing.lg },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  tabBtn: {
    flex: 1, paddingVertical: 9, borderRadius: radius.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  tabBtnActive: { borderColor: C.orange, backgroundColor: C.orange },
  tabText: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  tabTextActive: { color: C.white },
  form: { gap: spacing.md },
  label: { color: '#ffbf7c', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  termRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: spacing.md, height: 48,
  },
  prompt: { color: C.orange, fontWeight: '800', fontSize: 16 },
  termInput: { flex: 1, color: C.white, fontSize: 15 },
  input: {
    height: 48, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.07)',
    color: C.white, paddingHorizontal: spacing.md, fontSize: 15,
  },
  row2: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1, gap: spacing.xs },
  btn: {
    height: 48, backgroundColor: C.orange, borderRadius: radius.sm,
    justifyContent: 'center', alignItems: 'center', marginTop: spacing.xs,
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { color: C.white, fontWeight: '800', fontSize: 14, textTransform: 'uppercase' },
  statusText: { color: '#ffd8ad', fontSize: 13, fontWeight: '700', minHeight: 18 },
  tokenBox: {
    borderWidth: 1, borderColor: 'rgba(241,134,29,0.5)',
    borderRadius: radius.sm, backgroundColor: 'rgba(241,134,29,0.12)',
    padding: spacing.md, gap: spacing.xs,
  },
  tokenLabel: { color: '#ffbf7c', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  tokenValue: { color: C.white, fontWeight: '700', fontSize: 13 },
  tokenNote: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
});
