import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Switch,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Circle } from "react-native-svg";
import { ModalHeader } from "../components/ModalHeader";
import { hapticFeedback } from "../utils/haptics";
import {
  medicationReminderService,
  type AdherenceStats,
} from "../services/medicationReminderService";
import type { MedicationDoseSchedule, MedicationDoseLog } from "../data/types";
import type { WelliApp } from "../state/useWelliApp";

export function MedicationReminderModal({ app }: { app: WelliApp }) {
  const { state, actions, family } = app;

  const [doses, setDoses] = useState<
    Array<{ schedule: MedicationDoseSchedule; log?: MedicationDoseLog }>
  >([]);
  const [stats, setStats] = useState<AdherenceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDoseForSkip, setSelectedDoseForSkip] = useState<string | null>(null);

  const activeMember =
    family.find((f) => f.id === state.activeFamilyId) ?? family[0];

  const loadData = useCallback(async () => {
    setLoading(true);
    const ownerId = state.activeFamilyId || "me";
    const [todayDoses, adherenceStats] = await Promise.all([
      medicationReminderService.getTodayDoses(ownerId),
      medicationReminderService.getAdherenceStats(ownerId),
    ]);
    setDoses(todayDoses);
    setStats(adherenceStats);
    setLoading(false);
  }, [state.activeFamilyId]);

  useEffect(() => {
    if (state.showMedicationReminder) {
      loadData();
    }
  }, [state.showMedicationReminder, loadData]);

  if (!state.showMedicationReminder) return null;

  const handleTakeDose = async (scheduleId: string) => {
    hapticFeedback.success();
    await medicationReminderService.recordDoseAction(scheduleId, "taken", {
      ownerId: state.activeFamilyId || "me",
    });
    actions.showToast("Dose recorded as taken! Keep up the good routine. 💊");
    loadData();
  };

  const handleSnoozeDose = async (scheduleId: string) => {
    hapticFeedback.medium();
    await medicationReminderService.recordDoseAction(scheduleId, "snoozed", {
      snoozeMinutes: 15,
      ownerId: state.activeFamilyId || "me",
    });
    actions.showToast("Dose snoozed for 15 minutes. We will remind you! ⏰");
    loadData();
  };

  const handleSkipDose = async (scheduleId: string, reason: string = "Missed window") => {
    hapticFeedback.light();
    await medicationReminderService.recordDoseAction(scheduleId, "skipped", {
      skipReason: reason,
      ownerId: state.activeFamilyId || "me",
    });
    setSelectedDoseForSkip(null);
    actions.showToast("Dose marked as skipped.");
    loadData();
  };

  const handleToggleReminder = async (scheduleId: string, enabled: boolean) => {
    hapticFeedback.light();
    await medicationReminderService.toggleNotification(scheduleId, enabled);
    actions.showToast(
      enabled ? "Daily push reminder activated" : "Reminder paused for this dose"
    );
    loadData();
  };

  return (
    <Modal
      visible={state.showMedicationReminder}
      animationType="slide"
      transparent={false}
      onRequestClose={actions.closeMedicationReminder}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title="Daily Medication Reminders"
          onClose={actions.closeMedicationReminder}
        />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
        >
          {/* Patient Overview Badge */}
          <View style={styles.patientRow}>
            <View style={styles.patientAvatar}>
              <Text style={styles.patientAvatarText}>
                {activeMember.initials || "ME"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>{activeMember.name}</Text>
              <Text style={styles.patientSub}>
                {doses.length} Active Prescribed Routine(s)
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={actions.openOrderMedication}
              style={styles.newPrescriptionBtn}
            >
              <Text style={styles.newPrescriptionBtnText}>+ Add Med</Text>
            </TouchableOpacity>
          </View>

          {/* Adherence Routine Card */}
          {stats && (
            <LinearGradient
              colors={["#0b2545", "#133e68"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.adherenceCard}
            >
              <View style={styles.adherenceTopRow}>
                <View>
                  <Text style={styles.adherenceLabel}>MEDICATION ADHERENCE</Text>
                  <View style={styles.streakBadge}>
                    <Text style={styles.streakText}>🔥 {stats.streakDays}-Day Streak</Text>
                  </View>
                </View>
                <View style={styles.complianceScoreBox}>
                  <Text style={styles.complianceScoreNum}>
                    {stats.monthlyCompliancePercent}%
                  </Text>
                  <Text style={styles.complianceScoreLabel}>30-Day Rate</Text>
                </View>
              </View>

              {/* Weekly Routine Visual Dots */}
              <View style={styles.weeklyTrackerBox}>
                <Text style={styles.weeklyTrackerTitle}>This Week’s Routine</Text>
                <View style={styles.weeklyDaysRow}>
                  {stats.weeklyLogs.map((item, idx) => {
                    const isDone = item.status === "complete";
                    const isPartial = item.status === "partial";
                    const isMissed = item.status === "missed";
                    const isToday = idx === stats.weeklyLogs.length - 1;

                    return (
                      <View key={`${item.date}-${idx}`} style={styles.dayCol}>
                        <View
                          style={[
                            styles.dayCircle,
                            isDone && styles.dayCircleDone,
                            isPartial && styles.dayCirclePartial,
                            isMissed && styles.dayCircleMissed,
                            isToday && styles.dayCircleToday,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayCircleText,
                              isDone && styles.dayCircleTextDone,
                              isToday && styles.dayCircleTextToday,
                            ]}
                          >
                            {isDone ? "✓" : isMissed ? "✕" : item.dayLetter}
                          </Text>
                        </View>
                        <Text style={[styles.daySubText, isToday && styles.daySubTextToday]}>
                          {item.dayLetter}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Today Progress Bar */}
              <View style={styles.todayProgressContainer}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.todayProgressLabel}>Today’s Scheduled Doses</Text>
                  <Text style={styles.todayProgressValue}>
                    {stats.todayTaken} of {stats.todayTotal} taken ({stats.todayPercentage}%)
                  </Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.min(100, stats.todayPercentage)}%` },
                    ]}
                  />
                </View>
              </View>
            </LinearGradient>
          )}

          {/* Doses Section Title */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Today’s Dose Schedule</Text>
            <Text style={styles.sectionDate}>
              {new Date().toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </Text>
          </View>

          {/* Doses List */}
          {doses.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ fontSize: 32 }}>💊</Text>
              <Text style={styles.emptyTitle}>No scheduled doses for today</Text>
              <Text style={styles.emptySub}>
                Add a prescription or customize your reminders to track daily doses.
              </Text>
            </View>
          ) : (
            doses.map(({ schedule, log }) => {
              const isTaken = log?.status === "taken";
              const isSnoozed = log?.status === "snoozed";
              const isSkipped = log?.status === "skipped";

              return (
                <View key={schedule.id} style={styles.doseCard}>
                  <View style={styles.doseCardHeader}>
                    <View style={styles.timeTag}>
                      <Text style={styles.timeTagText}>⏰ {schedule.time}</Text>
                    </View>

                    <View style={styles.statusPillWrapper}>
                      {isTaken ? (
                        <View style={styles.pillTaken}>
                          <Text style={styles.pillTakenText}>✓ Taken</Text>
                        </View>
                      ) : isSnoozed ? (
                        <View style={styles.pillSnoozed}>
                          <Text style={styles.pillSnoozedText}>⏰ Snoozed</Text>
                        </View>
                      ) : isSkipped ? (
                        <View style={styles.pillSkipped}>
                          <Text style={styles.pillSkippedText}>✕ Skipped</Text>
                        </View>
                      ) : (
                        <View style={styles.pillDue}>
                          <Text style={styles.pillDueText}>● Due</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <Text style={styles.medName}>{schedule.medicationName}</Text>
                  <Text style={styles.medDosage}>{schedule.dosage}</Text>
                  <Text style={styles.medInstruction}>
                    💡 {schedule.instruction}
                  </Text>

                  {/* Actions Row */}
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleTakeDose(schedule.id)}
                      style={[
                        styles.takeBtn,
                        isTaken && styles.takeBtnDone,
                      ]}
                    >
                      <Text style={[styles.takeBtnText, isTaken && styles.takeBtnTextDone]}>
                        {isTaken ? "✓ Dose Taken" : "✓ Mark Taken"}
                      </Text>
                    </TouchableOpacity>

                    {!isTaken && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleSnoozeDose(schedule.id)}
                        style={styles.snoozeBtn}
                      >
                        <Text style={styles.snoozeBtnText}>Snooze (15m)</Text>
                      </TouchableOpacity>
                    )}

                    {!isTaken && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setSelectedDoseForSkip(schedule.id)}
                        style={styles.skipBtn}
                      >
                        <Text style={styles.skipBtnText}>Skip</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Skip Options Overlay (if active) */}
                  {selectedDoseForSkip === schedule.id && (
                    <View style={styles.skipReasonBox}>
                      <Text style={styles.skipReasonTitle}>Reason for skipping:</Text>
                      <View style={styles.skipReasonChips}>
                        {["Forgot at home", "Nausea/Reaction", "Fasting", "Doctor advice"].map(
                          (reason) => (
                            <TouchableOpacity
                              key={reason}
                              activeOpacity={0.7}
                              onPress={() => handleSkipDose(schedule.id, reason)}
                              style={styles.skipReasonChip}
                            >
                              <Text style={styles.skipReasonChipText}>{reason}</Text>
                            </TouchableOpacity>
                          )
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => setSelectedDoseForSkip(null)}
                        style={{ alignSelf: "center", marginTop: 6 }}
                      >
                        <Text style={styles.cancelSkipText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Notification Toggle Footer */}
                  <View style={styles.cardFooter}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontSize: 13 }}>🔔</Text>
                      <Text style={styles.reminderToggleLabel}>
                        Daily phone notification at {schedule.time}
                      </Text>
                    </View>
                    <Switch
                      value={schedule.notificationEnabled}
                      onValueChange={(val) => handleToggleReminder(schedule.id, val)}
                      trackColor={{ false: "#cbd5e1", true: "#93c5fd" }}
                      thumbColor={schedule.notificationEnabled ? "#1d4ed8" : "#94a3b8"}
                    />
                  </View>
                </View>
              );
            })
          )}

          {/* Safety Clinical Disclaimer */}
          <View style={styles.disclaimerCard}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 9v4M12 17h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"
                stroke="#64748b"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.disclaimerText}>
              WelliRecord pill reminders are self-management support tools and not medical orders. Always follow specific administration instructions from your prescribing physician.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollArea: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  patientRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  patientAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#0b2545",
    alignItems: "center",
    justifyContent: "center",
  },
  patientAvatarText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  patientName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  patientSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
  },
  newPrescriptionBtn: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  newPrescriptionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e3a8a",
  },
  adherenceCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    shadowColor: "#0b2545",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  adherenceTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  adherenceLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#93c5fd",
    letterSpacing: 0.8,
  },
  streakBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  streakText: {
    color: "#fbbf24",
    fontSize: 12,
    fontWeight: "700",
  },
  complianceScoreBox: {
    alignItems: "flex-end",
  },
  complianceScoreNum: {
    fontSize: 24,
    fontWeight: "800",
    color: "#ffffff",
  },
  complianceScoreLabel: {
    fontSize: 10,
    color: "#cbd5e1",
    fontWeight: "600",
  },
  weeklyTrackerBox: {
    marginTop: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    padding: 12,
  },
  weeklyTrackerTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#e2e8f0",
    marginBottom: 10,
  },
  weeklyDaysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayCol: {
    alignItems: "center",
    gap: 4,
  },
  dayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircleDone: {
    backgroundColor: "#10b981",
  },
  dayCirclePartial: {
    backgroundColor: "#f59e0b",
  },
  dayCircleMissed: {
    backgroundColor: "#ef4444",
  },
  dayCircleToday: {
    borderWidth: 2,
    borderColor: "#38bdf8",
  },
  dayCircleText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
  },
  dayCircleTextDone: {
    color: "#ffffff",
  },
  dayCircleTextToday: {
    fontWeight: "800",
  },
  daySubText: {
    fontSize: 10,
    color: "#94a3b8",
  },
  daySubTextToday: {
    color: "#38bdf8",
    fontWeight: "700",
  },
  todayProgressContainer: {
    marginTop: 16,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  todayProgressLabel: {
    fontSize: 11,
    color: "#cbd5e1",
    fontWeight: "600",
  },
  todayProgressValue: {
    fontSize: 11,
    color: "#ffffff",
    fontWeight: "700",
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#10b981",
    borderRadius: 3,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  sectionDate: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 10,
  },
  emptySub: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    marginTop: 4,
  },
  doseCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000000",
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  doseCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  timeTag: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeTagText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e293b",
  },
  statusPillWrapper: {},
  pillTaken: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pillTakenText: {
    color: "#15803d",
    fontSize: 11,
    fontWeight: "700",
  },
  pillSnoozed: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pillSnoozedText: {
    color: "#b45309",
    fontSize: 11,
    fontWeight: "700",
  },
  pillSkipped: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pillSkippedText: {
    color: "#b91c1c",
    fontSize: 11,
    fontWeight: "700",
  },
  pillDue: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pillDueText: {
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: "700",
  },
  medName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  medDosage: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563eb",
    marginTop: 2,
  },
  medInstruction: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  takeBtn: {
    flex: 1,
    backgroundColor: "#0b2545",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  takeBtnDone: {
    backgroundColor: "#10b981",
  },
  takeBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  takeBtnTextDone: {
    color: "#ffffff",
  },
  snoozeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fde68a",
    alignItems: "center",
    justifyContent: "center",
  },
  snoozeBtnText: {
    color: "#b45309",
    fontSize: 12,
    fontWeight: "700",
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  skipBtnText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  skipReasonBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  skipReasonTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 6,
  },
  skipReasonChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  skipReasonChip: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  skipReasonChipText: {
    fontSize: 11,
    color: "#1e293b",
  },
  cancelSkipText: {
    fontSize: 11,
    color: "#64748b",
    textDecorationLine: "underline",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  reminderToggleLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  disclaimerCard: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#f1f5f9",
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    alignItems: "flex-start",
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: "#64748b",
    lineHeight: 16,
  },
});
