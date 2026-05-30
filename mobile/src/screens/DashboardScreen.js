import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { darkColors, lightColors, spacing, radius, textStyles } from '../theme';

function formatDateLong(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('pl-PL', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

export default function DashboardScreen({ navigation }) {
  const { data, gameState, getResult, getRanking, getCurrentTheme, getAccentColor, isAdmin } = useApp();
  const theme = getCurrentTheme();
  const C = theme === 'dark' ? darkColors : lightColors;
  const accent = getAccentColor();

  const stats = useMemo(() => {
    const played = Object.values(gameState.results || {}).filter(
      r => r && Number.isInteger(r.home) && Number.isInteger(r.away),
    ).length;
    const next = data.matches.find(m => !getResult(m.id)) || data.matches[data.matches.length - 1];
    const rankRows = getRanking();
    const leader = rankRows[0] ? `${rankRows[0].player} · ${rankRows[0].total} pkt` : '–';
    const scoring = `${data.scoring.outcome} / ${data.scoring.goalDifference} / ${data.scoring.exactGoals}`;
    return { played, total: data.matches.length, players: gameState.players.length, next, leader, scoring, rankRows };
  }, [gameState, data]);

  const s = makeStyles(C, accent);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerMark} />
          <View>
            <Text style={s.headerWord}>KIPI</Text>
            <Text style={s.headerSub}>Mundial 2026 Typer</Text>
          </View>
        </View>

        {/* Next match */}
        {stats.next && (
          <View style={s.nextCard}>
            <Text style={s.nextEyebrow}>Najbliższy mecz</Text>
            <Text style={s.nextTeams}>
              {stats.next.homeTeam}{'\n'}vs{'\n'}{stats.next.awayTeam}
            </Text>
            <View style={s.nextMeta}>
              <Text style={s.nextMetaText}>{formatDateLong(stats.next.polandTime)}</Text>
              <Text style={s.nextMetaText}>
                {stats.next.stage}{stats.next.group ? ` · Grupa ${stats.next.group}` : ''}
              </Text>
              <Text style={s.nextMetaText}>{stats.next.venue}</Text>
            </View>
          </View>
        )}

        {/* Metric grid */}
        <View style={s.metrics}>
          <View style={[s.metric, s.metricDouble]}>
            <Text style={s.metricLabel}>Mecze</Text>
            <Text style={s.metricValue}>{stats.played} / {stats.total}</Text>
          </View>
          <View style={s.metric}>
            <Text style={s.metricLabel}>Typerzy</Text>
            <Text style={s.metricValue}>{stats.players}</Text>
          </View>
          <View style={[s.metric, { flex: 2 }]}>
            <Text style={s.metricLabel}>Lider</Text>
            <Text style={s.metricValue} numberOfLines={1}>{stats.leader}</Text>
          </View>
          <View style={[s.metric, s.metricAccent]}>
            <Text style={[s.metricLabel, s.metricLabelAccent]}>Punktacja</Text>
            <Text style={s.metricValue}>{stats.scoring}</Text>
            <Text style={s.metricHint}>znak / RB / dokł.</Text>
          </View>
        </View>

        {/* Quick actions */}
        <View style={s.actions}>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: accent }]} onPress={() => navigation.navigate('Typowanie')}>
            <Ionicons name="pencil" size={18} color="#fff" />
            <Text style={s.actionBtnText}>Dodaj typ</Text>
          </TouchableOpacity>
          {isAdmin() && (
            <TouchableOpacity style={[s.actionBtn, s.actionBtnGhost, { borderColor: C.line }]} onPress={() => navigation.navigate('Mecze')}>
              <Ionicons name="stats-chart" size={18} color={C.muted} />
              <Text style={[s.actionBtnText, { color: C.muted }]}>Wyniki</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Top 3 ranking */}
        {stats.rankRows.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: accent }]}>Top ranking</Text>
            {stats.rankRows.slice(0, 3).map((row, i) => (
              <View key={row.player} style={s.rankRow}>
                <Text style={[s.rankPos, i === 0 && { color: accent }]}>{i + 1}</Text>
                <Text style={s.rankName} numberOfLines={1}>{row.player}</Text>
                <Text style={s.rankPts}>{row.total} pkt</Text>
              </View>
            ))}
            <TouchableOpacity onPress={() => navigation.navigate('Ranking')}>
              <Text style={[s.seeAll, { color: accent }]}>Zobacz pełny ranking →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C, accent) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
    headerMark: { width: 40, height: 40, borderRadius: 8, backgroundColor: accent },
    headerWord: { color: C.ink, fontSize: 22, fontWeight: '800', textTransform: 'uppercase' },
    headerSub: { color: C.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    nextCard: {
      backgroundColor: '#1f7a4d', borderRadius: radius.lg,
      padding: spacing.xl, marginBottom: spacing.md,
      shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.28, shadowRadius: 14, elevation: 8,
    },
    nextEyebrow: { color: '#ffd6a5', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: spacing.sm },
    nextTeams: { color: '#fff', fontSize: 26, fontWeight: '800', textTransform: 'uppercase', lineHeight: 30, marginBottom: spacing.lg },
    nextMeta: { gap: spacing.xs },
    nextMetaText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700' },
    metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    metric: {
      flex: 1, minWidth: '44%', padding: spacing.md,
      backgroundColor: C.surface, borderRadius: radius.md,
      borderWidth: 1, borderColor: C.line,
    },
    metricDouble: { flex: 2 },
    metricAccent: { backgroundColor: C.surface, borderColor: accent, borderWidth: 1.5 },
    metricLabel: { color: C.muted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 },
    metricLabelAccent: { color: accent },
    metricValue: { color: C.ink, fontSize: 20, fontWeight: '800' },
    metricHint: { color: C.muted, fontSize: 10, fontWeight: '600', marginTop: 3 },
    actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
    actionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: spacing.sm, height: 46, borderRadius: radius.md,
    },
    actionBtnGhost: { borderWidth: 1, backgroundColor: 'transparent' },
    actionBtnText: { color: '#fff', fontWeight: '800', fontSize: 13, textTransform: 'uppercase' },
    section: {
      backgroundColor: C.surface, borderRadius: radius.md,
      borderWidth: 1, borderColor: C.line, padding: spacing.lg,
    },
    sectionLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: spacing.md },
    rankRow: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: C.line,
    },
    rankPos: { width: 28, fontSize: 16, fontWeight: '800', color: C.muted },
    rankName: { flex: 1, color: C.ink, fontSize: 14, fontWeight: '700' },
    rankPts: { color: C.muted, fontSize: 13, fontWeight: '700' },
    seeAll: { marginTop: spacing.md, fontSize: 13, fontWeight: '700' },
  });
}
