import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { darkColors, lightColors, spacing, radius } from '../theme';

function formatDate(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function PredictionInput({ matchId, player, C }) {
  const { getPrediction, setPrediction, getResult, scorePrediction, currentAccount, isAdmin, displayName } = useApp();
  const prediction = getPrediction(player, matchId);
  const actual = getResult(matchId);
  const score = scorePrediction(prediction, actual);

  const acc = currentAccount();
  const canEdit = isAdmin(acc) || player === displayName(acc);

  const [home, setHome] = useState(prediction?.home?.toString() ?? '');
  const [away, setAway] = useState(prediction?.away?.toString() ?? '');

  useEffect(() => {
    setHome(prediction?.home?.toString() ?? '');
    setAway(prediction?.away?.toString() ?? '');
  }, [prediction?.home, prediction?.away]);

  async function save(h, a) {
    if (!canEdit) return;
    if (h === '' && a === '') { await setPrediction(player, matchId, null); return; }
    const hn = parseInt(h, 10), an = parseInt(a, 10);
    if (Number.isFinite(hn) && hn >= 0 && Number.isFinite(an) && an >= 0) {
      await setPrediction(player, matchId, { home: hn, away: an });
    }
  }

  return (
    <View style={piStyles.wrap}>
      <TextInput
        style={[piStyles.input, !canEdit && piStyles.inputDisabled, { backgroundColor: C.surfaceRaised, color: C.ink, borderColor: C.line }]}
        value={home}
        onChangeText={setHome}
        onBlur={() => save(home, away)}
        keyboardType="numeric"
        maxLength={2}
        editable={canEdit}
        textAlign="center"
      />
      <Text style={{ color: C.muted, fontWeight: '800', fontSize: 16 }}>:</Text>
      <TextInput
        style={[piStyles.input, !canEdit && piStyles.inputDisabled, { backgroundColor: C.surfaceRaised, color: C.ink, borderColor: C.line }]}
        value={away}
        onChangeText={setAway}
        onBlur={() => save(home, away)}
        keyboardType="numeric"
        maxLength={2}
        editable={canEdit}
        textAlign="center"
      />
      {actual && prediction && (
        <View style={[piStyles.pts, { backgroundColor: C.greenSoft }]}>
          <Text style={[piStyles.ptsText, { color: C.green }]}>{score.total}</Text>
        </View>
      )}
    </View>
  );
}

const piStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: { width: 44, height: 44, borderWidth: 1, borderRadius: 6, fontSize: 16, fontWeight: '800' },
  inputDisabled: { opacity: 0.55 },
  pts: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, minWidth: 34, alignItems: 'center' },
  ptsText: { fontSize: 12, fontWeight: '800' },
});

function PredCard({ match, player, C }) {
  const { getResult, getPrediction, scorePrediction } = useApp();
  const actual = getResult(match.id);
  const pred = getPrediction(player, match.id);

  return (
    <View style={[pc.card, { backgroundColor: C.surface, borderColor: C.line }]}>
      <View style={[pc.accentBar, { backgroundColor: '#f1861d' }]} />
      <View style={pc.numWrap}>
        <View style={[pc.num, { backgroundColor: C.surfaceRaised }]}>
          <Text style={[pc.numText, { color: C.ink }]}>{match.id}</Text>
        </View>
      </View>
      <View style={pc.info}>
        <Text style={[pc.teams, { color: C.ink }]}>{match.homeTeam} – {match.awayTeam}</Text>
        <Text style={[pc.meta, { color: C.muted }]}>{formatDate(match.polandTime)} · {match.venue}</Text>
        {actual && (
          <Text style={[pc.result, { color: C.green }]}>Wynik: {actual.home}:{actual.away}</Text>
        )}
      </View>
      <View style={pc.inputWrap}>
        <PredictionInput matchId={match.id} player={player} C={C} />
      </View>
    </View>
  );
}

const pc = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderLeftWidth: 0, borderRadius: radius.md,
    marginBottom: spacing.sm, overflow: 'hidden',
  },
  accentBar: { width: 4, alignSelf: 'stretch' },
  numWrap: { paddingHorizontal: spacing.sm },
  num: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  numText: { fontWeight: '800', fontSize: 13 },
  info: { flex: 1, paddingVertical: spacing.md },
  teams: { fontWeight: '700', fontSize: 13, lineHeight: 19 },
  meta: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  result: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  inputWrap: { paddingRight: spacing.md },
});

export default function PredictionsScreen() {
  const { data, gameState, isAdmin, currentAccount, displayName, setActivePlayer, getRanking, getCurrentTheme, getAccentColor } = useApp();
  const theme = getCurrentTheme();
  const C = theme === 'dark' ? darkColors : lightColors;
  const accent = getAccentColor();

  const acc = currentAccount();
  const canAdmin = isAdmin(acc);
  const player = gameState.activePlayer;

  const playerList = useMemo(() => {
    if (!canAdmin && acc) return [displayName(acc)];
    return gameState.players;
  }, [gameState.players, canAdmin, acc]);

  const rankRow = useMemo(() => {
    const rows = getRanking();
    return rows.find(r => r.player === player);
  }, [player, gameState]);

  const typed = useMemo(
    () => Object.keys(gameState.predictions?.[player] || {}).length,
    [player, gameState.predictions],
  );

  const s = makeStyles(C, accent);

  return (
    <View style={s.container}>
      {/* Player selector */}
      <View style={[s.selectorBar, { backgroundColor: C.surface, borderBottomColor: C.line }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.playerScroll}>
          {playerList.map(p => (
            <TouchableOpacity
              key={p}
              style={[s.playerChip, player === p && s.playerChipActive, player === p && { borderColor: accent, backgroundColor: accent }]}
              onPress={() => canAdmin && setActivePlayer(p)}
            >
              <Text style={[s.playerChipText, player === p && s.playerChipTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Summary */}
      <View style={[s.summary, { backgroundColor: '#242321' }]}>
        <View style={s.summaryBlock}>
          <Text style={s.summaryNum}>{rankRow?.total ?? 0}</Text>
          <Text style={s.summaryLabel}>punktów</Text>
        </View>
        <View style={s.summaryBlock}>
          <Text style={s.summaryNum}>{typed}</Text>
          <Text style={s.summaryLabel}>typów</Text>
        </View>
        <View style={s.summaryBlock}>
          <Text style={s.summaryNum}>{rankRow?.exact ?? 0}</Text>
          <Text style={s.summaryLabel}>dokładnych</Text>
        </View>
        <View style={s.summaryBlock}>
          <Text style={s.summaryNum}>{rankRow?.signs ?? 0}</Text>
          <Text style={s.summaryLabel}>znaków</Text>
        </View>
      </View>

      {!canAdmin && (
        <Text style={[s.clientNote, { borderLeftColor: accent, borderColor: C.line, backgroundColor: C.surface, color: C.muted }]}>
          Tryb klienta: edytujesz tylko własne typy.
        </Text>
      )}

      <FlatList
        data={data.matches}
        keyExtractor={m => String(m.id)}
        renderItem={({ item }) => <PredCard match={item} player={player} C={C} />}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function makeStyles(C, accent) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.paper },
    selectorBar: { borderBottomWidth: 1, paddingVertical: spacing.sm },
    playerScroll: { paddingHorizontal: spacing.md, gap: spacing.sm },
    playerChip: {
      paddingHorizontal: spacing.md, paddingVertical: 7,
      borderRadius: radius.full, borderWidth: 1, borderColor: C.line,
    },
    playerChipActive: {},
    playerChipText: { color: C.muted, fontSize: 13, fontWeight: '700' },
    playerChipTextActive: { color: '#fff' },
    summary: {
      flexDirection: 'row', paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    summaryBlock: { flex: 1, alignItems: 'center', gap: 2 },
    summaryNum: { color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 26 },
    summaryLabel: { color: '#ffbf7c', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
    clientNote: {
      marginHorizontal: spacing.md, marginTop: spacing.sm,
      padding: spacing.sm, borderRadius: radius.sm,
      borderLeftWidth: 4, borderWidth: 1,
      fontSize: 11, fontWeight: '700',
    },
    list: { padding: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  });
}
