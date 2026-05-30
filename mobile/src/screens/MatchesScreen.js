import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ScrollView,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { darkColors, lightColors, spacing, radius } from '../theme';

function formatDate(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('pl-PL', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function ScoreCell({ matchId, isAdminUser, C }) {
  const { getResult, setResult } = useApp();
  const result = getResult(matchId);
  const [home, setHome] = useState(result?.home?.toString() ?? '');
  const [away, setAway] = useState(result?.away?.toString() ?? '');
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    setHome(result?.home?.toString() ?? '');
    setAway(result?.away?.toString() ?? '');
  }, [result?.home, result?.away]);

  async function save(h, a) {
    if (!isAdminUser) return;
    if (h === '' && a === '') { await setResult(matchId, null); return; }
    const hn = parseInt(h, 10), an = parseInt(a, 10);
    if (Number.isFinite(hn) && hn >= 0 && Number.isFinite(an) && an >= 0) {
      await setResult(matchId, { home: hn, away: an });
    }
  }

  if (!isAdminUser) {
    if (!result) return <Text style={[scStyles.pill, { backgroundColor: C.surfaceRaised, color: C.muted }]}>–</Text>;
    return <Text style={[scStyles.pill, { backgroundColor: C.greenSoft, color: C.green }]}>{result.home}:{result.away}</Text>;
  }

  return (
    <View style={scStyles.row}>
      <TextInput
        style={[scStyles.input, { backgroundColor: C.surfaceRaised, color: C.ink, borderColor: C.line }]}
        value={home}
        onChangeText={setHome}
        onBlur={() => save(home, away)}
        keyboardType="numeric"
        maxLength={2}
        textAlign="center"
      />
      <Text style={{ color: C.muted, fontWeight: '800' }}>:</Text>
      <TextInput
        style={[scStyles.input, { backgroundColor: C.surfaceRaised, color: C.ink, borderColor: C.line }]}
        value={away}
        onChangeText={setAway}
        onBlur={() => save(home, away)}
        keyboardType="numeric"
        maxLength={2}
        textAlign="center"
      />
    </View>
  );
}

const scStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: { width: 42, height: 40, borderWidth: 1, borderRadius: 6, fontSize: 15, fontWeight: '800' },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, fontSize: 13, fontWeight: '800', overflow: 'hidden' },
});

function MatchCard({ match, isAdminUser, C }) {
  const { getResult } = useApp();
  const result = getResult(match.id);

  return (
    <View style={[mcStyles.card, { backgroundColor: C.surface, borderColor: C.line }]}>
      <View style={[mcStyles.accent, { backgroundColor: '#f1861d' }]} />
      <View style={mcStyles.numWrap}>
        <View style={[mcStyles.num, { backgroundColor: C.surfaceRaised }]}>
          <Text style={[mcStyles.numText, { color: C.ink }]}>{match.id}</Text>
        </View>
      </View>
      <View style={mcStyles.info}>
        <Text style={[mcStyles.teams, { color: C.ink }]}>
          {match.homeTeam} – {match.awayTeam}
        </Text>
        <Text style={[mcStyles.meta, { color: C.muted }]}>
          {match.stage}{match.group ? ` · Gr. ${match.group}` : ''}
        </Text>
        <Text style={[mcStyles.meta, { color: C.muted }]}>
          {formatDate(match.polandTime)} · {match.venue}
        </Text>
      </View>
      <View style={mcStyles.scoreWrap}>
        <ScoreCell matchId={match.id} isAdminUser={isAdminUser} C={C} />
        {!result && !isAdminUser && (
          <Text style={[mcStyles.upcoming, { color: C.muted }]}>Do rozegrania</Text>
        )}
      </View>
    </View>
  );
}

const mcStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderLeftWidth: 0, borderRadius: radius.md,
    marginBottom: spacing.sm, overflow: 'hidden',
  },
  accent: { width: 4, alignSelf: 'stretch' },
  numWrap: { paddingHorizontal: spacing.sm },
  num: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  numText: { fontWeight: '800', fontSize: 14 },
  info: { flex: 1, paddingVertical: spacing.md, paddingRight: spacing.sm },
  teams: { fontWeight: '700', fontSize: 14, lineHeight: 20 },
  meta: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  scoreWrap: { paddingRight: spacing.md, alignItems: 'flex-end', gap: 4 },
  upcoming: { fontSize: 11, fontWeight: '700' },
});

const ALL_STAGES = '';

export default function MatchesScreen() {
  const { data, isAdmin, getCurrentTheme, getAccentColor } = useApp();
  const theme = getCurrentTheme();
  const C = theme === 'dark' ? darkColors : lightColors;
  const accent = getAccentColor();
  const isAdminUser = isAdmin();

  const [query, setQuery] = useState('');
  const [activeStage, setActiveStage] = useState(ALL_STAGES);
  const [activeGroup, setActiveGroup] = useState('');

  const stages = useMemo(
    () => [{ label: 'Wszystkie', value: ALL_STAGES }, ...new Set(data.matches.map(m => m.stage))].map(
      s => typeof s === 'string' ? { label: s, value: s } : s,
    ),
    [data.matches],
  );

  const groups = useMemo(() => Object.keys(data.groups), [data.groups]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.matches.filter(m => {
      if (q && !`${m.homeTeam} ${m.awayTeam} ${m.venue} ${m.stage}`.toLowerCase().includes(q)) return false;
      if (activeStage && m.stage !== activeStage) return false;
      if (activeGroup && m.group !== activeGroup) return false;
      return true;
    });
  }, [data.matches, query, activeStage, activeGroup]);

  const showGroupFilter = !activeStage || activeStage === 'Faza grupowa';

  const s = makeStyles(C, accent);

  return (
    <View style={s.container}>
      {/* Search */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Szukaj drużyny, miasta…"
          placeholderTextColor={C.muted}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Phase tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabsScroll}
        style={s.tabsBar}
      >
        {stages.map(({ label, value }) => (
          <TouchableOpacity
            key={value}
            style={[s.tab, activeStage === value && s.tabActive]}
            onPress={() => { setActiveStage(value); if (value !== '' && value !== 'Faza grupowa') setActiveGroup(''); }}
          >
            <Text style={[s.tabText, activeStage === value && s.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Group filter */}
      {showGroupFilter && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabsScroll}
          style={s.groupBar}
        >
          <TouchableOpacity
            style={[s.groupTab, activeGroup === '' && s.groupTabActive]}
            onPress={() => setActiveGroup('')}
          >
            <Text style={[s.groupTabText, activeGroup === '' && s.groupTabTextActive]}>Wszystkie</Text>
          </TouchableOpacity>
          {groups.map(g => (
            <TouchableOpacity
              key={g}
              style={[s.groupTab, activeGroup === g && s.groupTabActive]}
              onPress={() => setActiveGroup(g)}
            >
              <Text style={[s.groupTabText, activeGroup === g && s.groupTabTextActive]}>Gr. {g}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {!isAdminUser && (
        <Text style={s.clientNote}>Wyniki może wpisywać tylko administrator.</Text>
      )}

      <FlatList
        data={filtered}
        keyExtractor={m => String(m.id)}
        renderItem={({ item }) => <MatchCard match={item} isAdminUser={isAdminUser} C={C} />}
        contentContainerStyle={s.list}
        ListEmptyComponent={<Text style={s.empty}>Brak meczów dla wybranego filtra.</Text>}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function makeStyles(C, accent) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.paper },
    searchWrap: { padding: spacing.md, paddingBottom: 0 },
    searchInput: {
      height: 42, borderWidth: 1, borderColor: C.line,
      borderRadius: radius.sm, paddingHorizontal: spacing.md,
      backgroundColor: C.surface, color: C.ink, fontSize: 14,
    },
    tabsBar: { flexGrow: 0 },
    tabsScroll: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 6 },
    tab: {
      paddingHorizontal: spacing.md, paddingVertical: 7,
      borderRadius: radius.full, borderWidth: 1, borderColor: C.line,
    },
    tabActive: { borderColor: accent, backgroundColor: accent },
    tabText: { color: C.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
    tabTextActive: { color: '#fff' },
    groupBar: { flexGrow: 0 },
    groupTab: {
      paddingHorizontal: spacing.sm, paddingVertical: 5,
      borderRadius: radius.full, borderWidth: 1, borderColor: C.line,
      marginRight: 4,
    },
    groupTabActive: { borderColor: C.green, backgroundColor: C.green },
    groupTabText: { color: C.muted, fontSize: 11, fontWeight: '700' },
    groupTabTextActive: { color: '#fff' },
    clientNote: {
      marginHorizontal: spacing.md, marginBottom: spacing.sm,
      padding: spacing.sm, borderRadius: radius.sm,
      borderLeftWidth: 4, borderLeftColor: accent,
      borderWidth: 1, borderColor: C.line,
      backgroundColor: C.surface, color: C.muted,
      fontSize: 12, fontWeight: '700',
    },
    list: { padding: spacing.md, paddingTop: spacing.sm },
    empty: { color: C.muted, fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: spacing.xl },
  });
}
