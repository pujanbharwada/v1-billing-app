import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Share from 'react-native-share';
import {
  Bill,
  buildDateKey,
  getBillDateKey,
  isPopulatedItem,
  parseFiniteNumber,
} from '../utils/billing';

interface DaySummary {
  dateLabel: string;
  totalAmount: number;
  billCount: number;
  paidAmount: number;
  unpaidAmount: number;
  paidCount: number;
  unpaidCount: number;
  bills: Bill[];
}

export default function DailySummaryScreen({ navigation }: any) {
  const [dailySummaries, setDailySummaries] = useState<DaySummary[]>([]);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [todayKey, setTodayKey] = useState<string>('');

  const loadAndCalculate = useCallback(async () => {
    try {
      setTodayKey(buildDateKey(new Date()));
      const storedBills = await AsyncStorage.getItem('bills');

      if (!storedBills) {
        setDailySummaries([]);
        return;
      }

      const bills: Bill[] = JSON.parse(storedBills);

      if (!Array.isArray(bills) || bills.length === 0) {
        setDailySummaries([]);
        return;
      }

      const dateMap: { [key: string]: Bill[] } = {};

      bills.forEach(bill => {
        // Skip corrupted bills (total <= 0 and no items)
        const billTotal = parseFiniteNumber(bill?.total);
        const hasItems = (bill?.items || []).some(isPopulatedItem);
        if (billTotal <= 0 && !hasItems) {
          return;
        }

        const dateKey = getBillDateKey(bill);
        if (!dateKey) {
          return;
        }

        if (!dateMap[dateKey]) {
          dateMap[dateKey] = [];
        }
        dateMap[dateKey].push(bill);
      });

      const summaries: DaySummary[] = Object.entries(dateMap)
        .map(([dateLabel, dayBills]) => {
          let totalAmount = 0;
          let paidAmount = 0;
          let unpaidAmount = 0;
          let paidCount = 0;
          let unpaidCount = 0;

          dayBills.forEach(bill => {
            const billTotal = parseFiniteNumber(bill?.total);
            totalAmount += billTotal;

            const status = bill?.paymentStatus;
            if (status === 'Paid' || status === undefined || status === null) {
              paidAmount += billTotal;
              paidCount++;
            } else {
              unpaidAmount += billTotal;
              unpaidCount++;
            }
          });

          return {
            dateLabel,
            totalAmount,
            billCount: dayBills.length,
            paidAmount,
            unpaidAmount,
            paidCount,
            unpaidCount,
            bills: dayBills,
          };
        })
        .sort((a, b) => {
          const parseKey = (key: string) => {
            const [day, month, year] = key.split('/').map(Number);
            return new Date(year, month - 1, day).getTime();
          };
          return parseKey(b.dateLabel) - parseKey(a.dateLabel);
        });

      setDailySummaries(summaries);
    } catch (error) {
      console.log('Error loading daily summary', error);
      setDailySummaries([]);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation?.addListener('focus', loadAndCalculate);
    loadAndCalculate();
    return () => unsubscribe?.();
  }, [loadAndCalculate, navigation]);

  // FIXED: Guard against empty todayKey
  const isToday = (summary: DaySummary): boolean => {
    return todayKey !== '' && summary.dateLabel === todayKey;
  };

  const shareDaySummary = async (summary: DaySummary) => {
    try {
      let message = `📊 DAILY BUSINESS SUMMARY\n`;
      message += `📅 ${summary.dateLabel}\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      message += `📋 Total Bills: ${summary.billCount}\n`;
      message += `💰 Total Business: ₹${summary.totalAmount.toFixed(2)}\n\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      message += `BILL DETAILS:\n\n`;

      summary.bills.forEach((bill, idx) => {
        message += `${idx + 1}. ${
          bill?.customerName || 'No Name'
        } — ₹${parseFiniteNumber(bill?.total).toFixed(2)}\n`;
      });

      message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      message += `SANKESHWAR PARSHWANATH\n`;

      await Share.open({ message, failOnCancel: false });
    } catch {
      // Sharing errors are handled by the native share sheet.
    }
  };

  const todaySummary = dailySummaries.find(s => isToday(s));

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>📊 Daily Summary</Text>
      <Text style={styles.subHeading}>Today: {todayKey || '...'}</Text>

      {/* Today's Summary */}
      <View style={styles.todayCard}>
        <Text style={styles.todayLabel}>🗓️ TODAY'S BUSINESS</Text>

        {todaySummary ? (
          <View>
            <Text style={styles.todayAmount}>
              ₹{todaySummary.totalAmount.toFixed(2)}
            </Text>

            <View style={styles.todayStatsRow}>
              <View style={styles.todayStat}>
                <Text style={styles.todayStatValue}>
                  {todaySummary.billCount}
                </Text>
                <Text style={styles.todayStatLabel}>Bills</Text>
              </View>

              <View style={styles.todayStatDivider} />

              <View style={styles.todayStat}>
                <Text
                  style={[styles.todayStatValue, styles.todayBusinessValue]}
                >
                  ₹{todaySummary.totalAmount.toFixed(2)}
                </Text>
                <Text style={styles.todayStatLabel}>Total Business</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.shareDay}
              onPress={() => shareDaySummary(todaySummary)}
            >
              <Text style={styles.shareDayText}>📤 Share Today's Summary</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={styles.todayAmount}>₹0.00</Text>
            <Text style={styles.noBillsText}>No bills created today</Text>
          </View>
        )}
      </View>

      {/* All Days Breakdown */}
      <Text style={styles.sectionTitle}>📅 Date-Wise Summary</Text>

      {dailySummaries.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No bill history found</Text>
        </View>
      )}

      {dailySummaries.map(summary => {
        const isTodayCard = isToday(summary);
        const isExpanded = expandedDate === summary.dateLabel;

        return (
          <View key={summary.dateLabel}>
            <TouchableOpacity
              style={[styles.dayCard, isTodayCard && styles.dayCardToday]}
              onPress={() =>
                setExpandedDate(isExpanded ? null : summary.dateLabel)
              }
            >
              <View style={styles.dayCardHeader}>
                <View>
                  <Text
                    style={[styles.dayDate, isTodayCard && styles.dayDateToday]}
                  >
                    {isTodayCard ? '📌 TODAY' : summary.dateLabel}
                  </Text>
                  <Text style={styles.dayBillCount}>
                    {summary.billCount} Bill
                    {summary.billCount !== 1 ? 's' : ''}
                  </Text>
                </View>

                <View style={styles.dayAmountContainer}>
                  <Text
                    style={[
                      styles.dayAmount,
                      isTodayCard && styles.dayAmountToday,
                    ]}
                  >
                    ₹{summary.totalAmount.toFixed(2)}
                  </Text>
                  <Text style={styles.tapHint}>
                    {isExpanded ? '▲ Close' : '▼ Details'}
                  </Text>
                </View>
              </View>

              <View style={styles.totalBar}>
                <Text style={styles.totalBarText}>
                  💰 Total: ₹{summary.totalAmount.toFixed(0)}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Expanded Bill Details */}
            {isExpanded && (
              <View style={styles.expandedContainer}>
                {summary.bills.map((bill, bIdx) => (
                  <View
                    key={`${bill.invoiceNo}-${bill.createdAt}-${bIdx}`}
                    style={styles.billMiniCard}
                  >
                    <View style={styles.billMiniRow}>
                      <Text style={styles.billMiniInvoice}>
                        #{bill?.invoiceNo}
                      </Text>
                      <Text
                        style={[
                          styles.billMiniStatus,
                          bill?.paymentStatus === 'Paid' || !bill?.paymentStatus
                            ? styles.paidStatus
                            : styles.unpaidStatus,
                        ]}
                      >
                        {bill?.paymentStatus || 'Paid'}
                      </Text>
                    </View>
                    <Text style={styles.billMiniCustomer}>
                      {bill?.customerName || 'No Name'}
                    </Text>
                    <Text style={styles.billMiniTotal}>
                      ₹{parseFiniteNumber(bill?.total).toFixed(2)}
                    </Text>
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.shareDayBtn}
                  onPress={() => shareDaySummary(summary)}
                >
                  <Text style={styles.shareDayBtnText}>
                    📤 Share This Day's Summary
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    padding: 15,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1a1a2e',
    marginTop: 5,
  },
  subHeading: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  todayCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    marginBottom: 25,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  todayLabel: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 10,
  },
  todayAmount: {
    color: '#fff',
    fontSize: 42,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  noBillsText: {
    color: '#aaa',
    fontSize: 15,
    marginTop: 5,
  },
  todayStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  todayStat: {
    alignItems: 'center',
  },
  todayStatValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  todayBusinessValue: {
    color: '#FFD700',
  },
  todayStatLabel: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 4,
  },
  todayStatDivider: {
    width: 1,
    height: 35,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  shareDay: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  shareDayText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 15,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  dayCardToday: {
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dayDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  dayDateToday: {
    color: '#1a1a2e',
  },
  dayBillCount: {
    fontSize: 13,
    color: '#888',
    marginTop: 3,
  },
  dayAmountContainer: {
    alignItems: 'flex-end',
  },
  dayAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  dayAmountToday: {
    color: '#2e7d32',
  },
  tapHint: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 3,
  },
  totalBar: {
    backgroundColor: '#1a1a2e',
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalBarText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
  },
  expandedContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
    marginTop: -8,
    marginBottom: 12,
    borderTopWidth: 0,
  },
  billMiniCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
  },
  billMiniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  billMiniInvoice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
  },
  billMiniStatus: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  paidStatus: {
    color: '#4CAF50',
  },
  unpaidStatus: {
    color: '#FF5722',
  },
  billMiniCustomer: {
    fontSize: 15,
    color: '#333',
    marginBottom: 2,
  },
  billMiniTotal: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  shareDayBtn: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 5,
  },
  shareDayBtnText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 14,
  },
  bottomSpacer: {
    height: 40,
  },
});
