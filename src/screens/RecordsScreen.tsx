import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { Chip } from '../components/Chip';
import { RECORD_META, RECORD_TYPES } from '../data/mockData';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

export function RecordsScreen({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions, records, family, immunizations } = app;
  const [showImmDetails, setShowImmDetails] = useState(false);

  const activeMember = family.find((f) => f.id === state.activeFamilyId) ?? family[0];
  const ownedRecords = records.filter((r) => r.ownerId === state.activeFamilyId);
  const q = state.recordQuery.trim().toLowerCase();
  const filteredRecords = ownedRecords
    .filter((r) => state.recordFilter === 'All' || r.type === state.recordFilter)
    .filter(
      (r) =>
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.provider.toLowerCase().includes(q)
    );

  const completedCount = immunizations.filter((i) => i.status === 'completed').length;
  const totalImmCount = immunizations.length;
  const immPercentage = Math.round((completedCount / totalImmCount) * 100);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Title + Upload Button */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          {state.tabHistory.length > 0 && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={actions.goBackTab}
              style={[
                styles.backBtn,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              accessibilityLabel="Go back to previous page"
            >
              <Svg width={14} height={14} viewBox="0 0 20 20">
                <Path
                  d="M12 4l-6 6 6 6"
                  stroke={theme.text}
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
          )}
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Health Records</Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>
              {activeMember.id === 'me' ? 'Your Personal Vault' : `${activeMember.name}'s Vault`}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={actions.openUpload}
          style={styles.addBtn}
          accessibilityLabel="Add or scan new health record"
        >
          <Svg width={18} height={18} viewBox="0 0 20 20">
            <Path
              d="M10 3v14M3 10h14"
              stroke="#ffffff"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Child Immunization Interactive Widget (if Child Dependent Active) */}
      {activeMember.isChild && (
        <View style={styles.immCard}>
          <View style={styles.immCardHeader}>
            <View style={styles.immIconBadge}>
              <Text style={{ fontSize: 20 }}>💉</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.immCardTitle}>NPI Immunization Schedule</Text>
              <Text style={styles.immCardSub}>
                {completedCount} of {totalImmCount} Milestones Verified ({immPercentage}%)
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                hapticFeedback.light();
                setShowImmDetails(!showImmDetails);
              }}
              style={styles.toggleDetailsBtn}
            >
              <Text style={styles.toggleDetailsText}>{showImmDetails ? 'Hide' : 'View Schedule'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${immPercentage}%` }]} />
          </View>

          {/* Expandable Immunization Milestones List */}
          {showImmDetails && (
            <View style={styles.immMilestonesList}>
              {immunizations.map((item) => {
                const isCompleted = item.status === 'completed';
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.75}
                    onPress={() => actions.toggleImmunization(item.id)}
                    style={styles.milestoneRow}
                  >
                    <View style={[styles.checkCircle, isCompleted && styles.checkCircleCompleted]}>
                      {isCompleted && <Text style={styles.checkIcon}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.milestoneVaccine, isCompleted && styles.milestoneVaccineDone]}>
                        {item.vaccine}
                      </Text>
                      <Text style={styles.milestoneMeta}>
                        Target: {item.targetAge} · {item.diseaseTarget}
                      </Text>
                      {item.completedDate && (
                        <Text style={styles.milestoneAdministered}>
                          Administered: {item.completedDate} {item.administeredBy ? `· ${item.administeredBy}` : ''}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.statusPill, isCompleted ? styles.pillCompleted : styles.pillDue]}>
                      <Text style={[styles.statusPillText, isCompleted ? styles.pillTextCompleted : styles.pillTextDue]}>
                        {isCompleted ? 'Done' : 'Due'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <Svg width={16} height={16} viewBox="0 0 20 20" style={styles.searchIcon}>
          <Circle cx="8.5" cy="8.5" r="6" stroke={theme.mutedLight} strokeWidth={1.8} fill="none" />
          <Path d="M13 13l4 4" stroke={theme.mutedLight} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
        <TextInput
          value={state.recordQuery}
          onChangeText={actions.setRecordQuery}
          placeholder="Search records, diagnoses, labs..."
          placeholderTextColor={theme.mutedLight}
          style={[
            styles.searchInput,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
        />
      </View>

      {/* Filter Categories Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={{ paddingRight: 10 }}
      >
        {RECORD_TYPES.map((f) => (
          <Chip
            key={f}
            label={f}
            active={state.recordFilter === f}
            onClick={() => actions.setFilter(f)}
          />
        ))}
      </ScrollView>

      {/* Empty State */}
      {filteredRecords.length === 0 && (
        <View
          style={[
            styles.emptyCardBox,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={[styles.emptyIconCircle, { backgroundColor: '#eff6ff' }]}>
            <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
              <Rect x={4} y={3} width={16} height={18} rx={2} stroke="#0EA5E9" strokeWidth={1.8} />
              <Path d="M8 8h8M8 12h8M8 16h5" stroke="#0EA5E9" strokeWidth={1.6} strokeLinecap="round" />
            </Svg>
          </View>
          <Text style={[styles.emptyCardTitle, { color: theme.text }]}>
            No records in your vault yet
          </Text>
          <Text style={[styles.emptyCardSub, { color: theme.muted }]}>
            Scan or upload lab test results, prescriptions, or clinical summaries to organize them with verified OCR.
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              hapticFeedback.medium();
              actions.openUpload();
            }}
            style={styles.emptyActionBtn}
            accessibilityLabel="Add your first record"
          >
            <Svg width={15} height={15} viewBox="0 0 20 20">
              <Path
                d="M10 3v14M3 10h14"
                stroke="#ffffff"
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </Svg>
            <Text style={styles.emptyActionBtnText}>Add Your First Record</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Records List */}
      <View style={styles.recordsList}>
        {filteredRecords.map((r) => {
          const meta = RECORD_META[r.type];
          return (
            <TouchableOpacity
              key={r.id}
              activeOpacity={0.7}
              onPress={() => actions.openRecord(r.id)}
              style={[
                styles.recordCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={styles.recordTopRow}>
                <View style={[styles.recordEmojiBox, { backgroundColor: meta.tint }]}>
                  <Text style={styles.recordEmoji}>{meta.emoji}</Text>
                </View>
                <View style={styles.recordMainInfo}>
                  <Text
                    style={[styles.recordTitle, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {r.title}
                  </Text>
                  <Text style={[styles.recordProvider, { color: theme.muted }]}>
                    {r.provider}
                  </Text>
                </View>
                <Text style={[styles.recordDate, { color: theme.mutedLight }]}>
                  {r.date}
                </Text>
              </View>

              {/* Extracted Key Value Preview Chips */}
              {r.extractedOcr?.keyValues && r.extractedOcr.keyValues.length > 0 && (
                <View style={styles.ocrChipsRow}>
                  {r.extractedOcr.keyValues.slice(0, 2).map((kv) => (
                    <View key={kv.label} style={styles.ocrChip}>
                      <Text style={styles.ocrChipText}>
                        <Text style={{ fontWeight: '700' }}>{kv.label}:</Text> {kv.value}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.recordBottomRow}>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓ Verified OCR</Text>
                </View>
                <Text style={[styles.typeText, { color: theme.mutedLight }]}>
                  {r.type}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12.5,
    marginTop: 1,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#041E42',
    alignItems: 'center',
    justifyContent: 'center',
  },
  immCard: {
    backgroundColor: '#f5f3ff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    padding: 16,
    marginBottom: 16,
  },
  immCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  immIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  immCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4c1d95',
  },
  immCardSub: {
    fontSize: 12,
    color: '#6d28d9',
    marginTop: 1,
  },
  toggleDetailsBtn: {
    backgroundColor: '#ede9fe',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  toggleDetailsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6d28d9',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#e9d5ff',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#7c3aed',
    borderRadius: 3,
  },
  immMilestonesList: {
    marginTop: 14,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#e9d5ff',
    paddingTop: 12,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ede9fe',
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkCircleCompleted: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  checkIcon: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  milestoneVaccine: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  milestoneVaccineDone: {
    color: '#334155',
  },
  milestoneMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  milestoneAdministered: {
    fontSize: 10.5,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
  },
  statusPill: {
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  pillCompleted: {
    backgroundColor: '#ecfdf5',
  },
  pillDue: {
    backgroundColor: '#fef3c7',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  pillTextCompleted: {
    color: '#059669',
  },
  pillTextDue: {
    color: '#b45309',
  },
  searchWrapper: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 12,
  },
  searchIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 2,
  },
  searchInput: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingLeft: 38,
    paddingRight: 14,
    fontSize: 14,
  },
  filterScroll: {
    marginBottom: 14,
  },
  emptyCardBox: {
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
    marginTop: 8,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyCardSub: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: 6,
  },
  emptyActionBtn: {
    backgroundColor: '#041E42',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 4,
  },
  emptyActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  recordsList: {
    gap: 10,
  },
  recordCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  recordTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  recordEmojiBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordEmoji: {
    fontSize: 18,
  },
  recordMainInfo: {
    flex: 1,
  },
  recordTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  recordProvider: {
    fontSize: 12,
    marginTop: 2,
  },
  recordDate: {
    fontSize: 11.5,
  },
  ocrChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  ocrChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  ocrChipText: {
    fontSize: 11,
    color: '#334155',
  },
  recordBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  verifiedBadge: {
    backgroundColor: '#ecfdf5',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  verifiedText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669',
  },
  typeText: {
    fontSize: 11.5,
  },
});
