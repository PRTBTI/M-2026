import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Switch, Alert, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { darkColors, lightColors, spacing, radius } from '../theme';

function Section({ title, label, children, C, accent }) {
  return (
    <View style={[ss.section, { backgroundColor: C.surface, borderColor: C.line }]}>
      {label ? <Text style={[ss.eyebrow, { color: accent }]}>{label}</Text> : null}
      {title ? <Text style={[ss.title, { color: C.ink }]}>{title}</Text> : null}
      {children}
    </View>
  );
}

const ss = StyleSheet.create({
  section: {
    borderRadius: radius.md, borderWidth: 1,
    padding: spacing.lg, marginBottom: spacing.md,
  },
  eyebrow: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  title: { fontSize: 18, fontWeight: '800', textTransform: 'uppercase', marginBottom: spacing.lg },
});

function FormField({ label, C, children }) {
  return (
    <View style={ff.wrap}>
      <Text style={[ff.label, { color: C.muted }]}>{label}</Text>
      {children}
    </View>
  );
}

const ff = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 },
});

export default function AccountScreen() {
  const {
    currentAccount, isAdmin, displayName, logout, toggleTheme, saveSettings,
    addAccountFromAdmin, updateAccountRole, updateAccountStatus, deleteAccount,
    getRanking, gameState, accounts, getCurrentTheme, getAccentColor,
  } = useApp();

  const theme = getCurrentTheme();
  const C = theme === 'dark' ? darkColors : lightColors;
  const accent = getAccentColor();
  const acc = currentAccount();
  const canAdmin = isAdmin(acc);

  // Settings form
  const [nickname, setNickname] = useState(acc?.nickname || '');
  const [favTeam, setFavTeam] = useState(acc?.preferences?.favoriteTeam || '');
  const [compact, setCompact] = useState(Boolean(acc?.preferences?.compact));
  const [settingsMsg, setSettingsMsg] = useState('');

  useEffect(() => {
    if (!acc) return;
    setNickname(acc.nickname || '');
    setFavTeam(acc.preferences?.favoriteTeam || '');
    setCompact(Boolean(acc.preferences?.compact));
  }, [acc?.id]);

  // Stats
  const myStats = useMemo(() => {
    const rows = getRanking();
    const idx = rows.findIndex(r => r.player === gameState.activePlayer);
    const mine = rows[idx] || { total: 0, typed: 0, exact: 0 };
    return { ...mine, rank: idx >= 0 ? idx + 1 : '–' };
  }, [gameState]);

  // Admin new user form
  const [adminForm, setAdminForm] = useState({ firstName: '', lastName: '', email: '', nickname: '', password: '', role: 'client', verified: true });
  const [adminMsg, setAdminMsg] = useState('');

  function updateAdmin(key, value) { setAdminForm(f => ({ ...f, [key]: value })); }

  async function handleSaveSettings() {
    await saveSettings({ nickname, favoriteTeam: favTeam, accent, compact });
    setSettingsMsg('Zapisano.');
    setTimeout(() => setSettingsMsg(''), 3000);
  }

  async function handleAddUser() {
    const res = await addAccountFromAdmin(adminForm);
    if (res.error) { setAdminMsg(res.error); return; }
    setAdminMsg('Dodano użytkownika.');
    setAdminForm({ firstName: '', lastName: '', email: '', nickname: '', password: '', role: 'client', verified: true });
    setTimeout(() => setAdminMsg(''), 3000);
  }

  async function handleDeleteAccount(accountId, name) {
    Alert.alert('Usuń konto', `Usunąć użytkownika ${name}?`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń', style: 'destructive',
        onPress: async () => {
          const res = await deleteAccount(accountId);
          if (res.error) Alert.alert('Błąd', res.error);
        },
      },
    ]);
  }

  async function handleLogout() {
    Alert.alert('Wylogowanie', 'Czy na pewno chcesz się wylogować?', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Wyloguj', style: 'destructive', onPress: logout },
    ]);
  }

  const s = makeStyles(C, accent);

  if (!acc) return null;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* Profile */}
      <Section label="Konto" title="Panel indywidualny" C={C} accent={accent}>
        <View style={s.statsRow}>
          <View style={s.statBlock}>
            <Text style={[s.statNum, { color: accent }]}>{myStats.total}</Text>
            <Text style={[s.statLbl, { color: C.muted }]}>Punkty</Text>
          </View>
          <View style={s.statBlock}>
            <Text style={[s.statNum, { color: C.ink }]}>#{myStats.rank}</Text>
            <Text style={[s.statLbl, { color: C.muted }]}>Pozycja</Text>
          </View>
          <View style={s.statBlock}>
            <Text style={[s.statNum, { color: C.ink }]}>{myStats.typed}</Text>
            <Text style={[s.statLbl, { color: C.muted }]}>Typy</Text>
          </View>
          <View style={s.statBlock}>
            <Text style={[s.statNum, { color: C.green }]}>{myStats.exact}</Text>
            <Text style={[s.statLbl, { color: C.muted }]}>Dokładne</Text>
          </View>
        </View>
        <View style={[s.profileInfo, { borderTopColor: C.line }]}>
          <Text style={[s.profileName, { color: C.ink }]}>{displayName(acc)}</Text>
          <Text style={[s.profileMeta, { color: C.muted }]}>{acc.firstName} {acc.lastName} · {acc.email}</Text>
          <Text style={[s.profileRole, { color: accent }]}>{canAdmin ? 'Administrator' : 'Klient'}</Text>
        </View>
      </Section>

      {/* Settings */}
      <Section label="Preferencje" title="Ustawienia" C={C} accent={accent}>
        <FormField label="Pseudonim" C={C}>
          <TextInput
            style={[s.input, { backgroundColor: C.surfaceRaised, borderColor: C.line, color: C.ink }]}
            value={nickname}
            onChangeText={setNickname}
            maxLength={32}
            placeholder="Twój pseudonim"
            placeholderTextColor={C.muted}
          />
        </FormField>
        <FormField label="Ulubiona drużyna" C={C}>
          <TextInput
            style={[s.input, { backgroundColor: C.surfaceRaised, borderColor: C.line, color: C.ink }]}
            value={favTeam}
            onChangeText={setFavTeam}
            maxLength={48}
            placeholder="np. Polska"
            placeholderTextColor={C.muted}
          />
        </FormField>
        <View style={s.switchRow}>
          <Text style={[s.switchLabel, { color: C.ink }]}>Widok kompaktowy</Text>
          <Switch
            value={compact}
            onValueChange={setCompact}
            trackColor={{ false: C.line, true: accent }}
            thumbColor="#fff"
          />
        </View>
        <View style={s.switchRow}>
          <Text style={[s.switchLabel, { color: C.ink }]}>Tryb {theme === 'dark' ? 'jasny' : 'ciemny'}</Text>
          <TouchableOpacity onPress={toggleTheme}>
            <Ionicons name={theme === 'dark' ? 'sunny-outline' : 'moon-outline'} size={22} color={accent} />
          </TouchableOpacity>
        </View>
        {!!settingsMsg && <Text style={[s.statusMsg, { color: C.green }]}>{settingsMsg}</Text>}
        <TouchableOpacity style={[s.btn, { backgroundColor: accent }]} onPress={handleSaveSettings}>
          <Text style={s.btnText}>Zapisz ustawienia</Text>
        </TouchableOpacity>
      </Section>

      {/* Admin: add user */}
      {canAdmin && (
        <Section label="Administrator" title="Dodaj użytkownika" C={C} accent={accent}>
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <FormField label="Imię" C={C}>
                <TextInput style={[s.input, { backgroundColor: C.surfaceRaised, borderColor: C.line, color: C.ink }]} value={adminForm.firstName} onChangeText={v => updateAdmin('firstName', v)} autoCapitalize="words" />
              </FormField>
            </View>
            <View style={{ flex: 1 }}>
              <FormField label="Nazwisko" C={C}>
                <TextInput style={[s.input, { backgroundColor: C.surfaceRaised, borderColor: C.line, color: C.ink }]} value={adminForm.lastName} onChangeText={v => updateAdmin('lastName', v)} autoCapitalize="words" />
              </FormField>
            </View>
          </View>
          <FormField label="E-mail" C={C}>
            <TextInput style={[s.input, { backgroundColor: C.surfaceRaised, borderColor: C.line, color: C.ink }]} value={adminForm.email} onChangeText={v => updateAdmin('email', v)} keyboardType="email-address" autoCapitalize="none" />
          </FormField>
          <FormField label="Pseudonim (opcjonalnie)" C={C}>
            <TextInput style={[s.input, { backgroundColor: C.surfaceRaised, borderColor: C.line, color: C.ink }]} value={adminForm.nickname} onChangeText={v => updateAdmin('nickname', v)} maxLength={32} />
          </FormField>
          <FormField label="Hasło tymczasowe" C={C}>
            <TextInput style={[s.input, { backgroundColor: C.surfaceRaised, borderColor: C.line, color: C.ink }]} value={adminForm.password} onChangeText={v => updateAdmin('password', v)} secureTextEntry />
          </FormField>
          <View style={s.roleRow}>
            {['client', 'admin'].map(role => (
              <TouchableOpacity
                key={role}
                style={[s.roleBtn, adminForm.role === role && { borderColor: accent, backgroundColor: `${accent}22` }]}
                onPress={() => updateAdmin('role', role)}
              >
                <Text style={[s.roleBtnText, { color: adminForm.role === role ? accent : C.muted }]}>
                  {role === 'client' ? 'Klient' : 'Administrator'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.switchRow}>
            <Text style={[s.switchLabel, { color: C.ink }]}>Konto potwierdzone</Text>
            <Switch
              value={adminForm.verified}
              onValueChange={v => updateAdmin('verified', v)}
              trackColor={{ false: C.line, true: accent }}
              thumbColor="#fff"
            />
          </View>
          {!!adminMsg && <Text style={[s.statusMsg, { color: adminMsg.startsWith('Dodano') ? C.green : C.danger }]}>{adminMsg}</Text>}
          <TouchableOpacity style={[s.btn, { backgroundColor: accent }]} onPress={handleAddUser}>
            <Text style={s.btnText}>Dodaj użytkownika</Text>
          </TouchableOpacity>
        </Section>
      )}

      {/* Admin: user list */}
      {canAdmin && (
        <Section label="Administrator" title="Lista użytkowników" C={C} accent={accent}>
          {accounts.map(a => (
            <View key={a.id} style={[s.userRow, { borderBottomColor: C.line }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.userName, { color: C.ink }]}>{displayName(a)}</Text>
                <Text style={[s.userEmail, { color: C.muted }]}>{a.email}</Text>
                <View style={s.userBadges}>
                  <Text style={[s.badge, { backgroundColor: a.role === 'admin' ? `${accent}25` : C.surfaceRaised, color: a.role === 'admin' ? accent : C.muted }]}>
                    {a.role === 'admin' ? 'Admin' : 'Klient'}
                  </Text>
                  <Text style={[s.badge, { backgroundColor: a.verified ? `${C.green}20` : C.surfaceRaised, color: a.verified ? C.green : C.muted }]}>
                    {a.verified ? 'Potwierdzone' : 'Oczekuje'}
                  </Text>
                </View>
              </View>
              <View style={s.userActions}>
                <TouchableOpacity
                  style={[s.miniBtn, { borderColor: C.line }]}
                  onPress={() => updateAccountRole(a.id, a.role === 'admin' ? 'client' : 'admin')}
                  disabled={a.id === acc.id}
                >
                  <Ionicons name="swap-horizontal" size={14} color={C.muted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.miniBtn, { borderColor: a.verified ? C.line : C.green }]}
                  onPress={() => updateAccountStatus(a.id, !a.verified)}
                >
                  <Ionicons name={a.verified ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={a.verified ? C.green : C.muted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.miniBtn, { borderColor: C.dangerSoft }]}
                  onPress={() => handleDeleteAccount(a.id, displayName(a))}
                  disabled={a.id === acc.id}
                >
                  <Ionicons name="trash-outline" size={14} color={C.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </Section>
      )}

      {/* Logout */}
      <TouchableOpacity style={[s.logoutBtn, { borderColor: C.danger }]} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color={C.danger} />
        <Text style={[s.logoutText, { color: C.danger }]}>Wyloguj</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

function makeStyles(C, accent) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: C.paper },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    statsRow: { flexDirection: 'row', marginBottom: spacing.lg },
    statBlock: { flex: 1, alignItems: 'center', gap: 2 },
    statNum: { fontSize: 24, fontWeight: '800', lineHeight: 28 },
    statLbl: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    profileInfo: { borderTopWidth: 1, paddingTop: spacing.md, gap: 3 },
    profileName: { fontSize: 18, fontWeight: '800' },
    profileMeta: { fontSize: 12, fontWeight: '600' },
    profileRole: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
    input: {
      height: 44, borderWidth: 1, borderRadius: radius.sm,
      paddingHorizontal: spacing.md, fontSize: 14,
    },
    row2: { flexDirection: 'row', gap: spacing.sm },
    switchRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: spacing.md,
    },
    switchLabel: { fontSize: 14, fontWeight: '600' },
    btn: { height: 46, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center', marginTop: spacing.xs },
    btnText: { color: '#fff', fontWeight: '800', fontSize: 14, textTransform: 'uppercase' },
    statusMsg: { fontSize: 13, fontWeight: '700', marginBottom: spacing.sm },
    roleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    roleBtn: {
      flex: 1, height: 38, borderRadius: radius.sm, borderWidth: 1,
      borderColor: C.line, justifyContent: 'center', alignItems: 'center',
    },
    roleBtnText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
    userRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: spacing.md, borderBottomWidth: 1,
    },
    userName: { fontSize: 14, fontWeight: '700' },
    userEmail: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    userBadges: { flexDirection: 'row', gap: 6, marginTop: 5 },
    badge: {
      paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: radius.full, fontSize: 10, fontWeight: '800',
      textTransform: 'uppercase', overflow: 'hidden',
    },
    userActions: { flexDirection: 'row', gap: 6, marginLeft: spacing.sm },
    miniBtn: {
      width: 32, height: 32, borderRadius: radius.sm,
      borderWidth: 1, justifyContent: 'center', alignItems: 'center',
    },
    logoutBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: spacing.sm, height: 48, borderRadius: radius.md,
      borderWidth: 1, marginTop: spacing.sm,
    },
    logoutText: { fontWeight: '800', fontSize: 14, textTransform: 'uppercase' },
  });
}
