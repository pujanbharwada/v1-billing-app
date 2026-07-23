import React, { useEffect, useState } from 'react';

import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import RNPrint from 'react-native-print';
import Share from 'react-native-share';
import {
  Bill,
  calculateRowTotal,
  escapeHtml,
  getBillDateKey,
  isPopulatedItem,
} from '../utils/billing';

export default function HistoryScreen({ navigation }: any) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [openedBill, setOpenedBill] = useState<Bill | null>(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    const unsubscribe = navigation?.addListener('focus', () => {
      loadBills();
    });

    loadBills();

    return () => unsubscribe?.();
  }, [navigation]);

  const loadBills = async () => {
    try {
      const savedBills = await AsyncStorage.getItem('bills');

      if (savedBills) {
        const parsedBills = JSON.parse(savedBills);

        if (Array.isArray(parsedBills)) {
          setBills(
            parsedBills
              .filter((bill: Bill | null) => bill != null)
              .slice()
              .reverse(),
          );
          setOpenedBill(null);
        } else {
          setBills([]);
          setOpenedBill(null);
        }
      } else {
        setBills([]);
        setOpenedBill(null);
      }
    } catch (error) {
      console.log('Error loading bills:', error);
      Alert.alert('History Error', 'Some bill data is corrupted.');
      setBills([]);
    }
  };

  const filteredBills = bills.filter(bill =>
    (bill.customerName ?? '')
      .toLowerCase()
      .includes(searchText.trim().toLowerCase()),
  );

  const deleteBill = (billToDelete: Bill) => {
    Alert.alert('Delete Bill', 'Delete this bill?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },

      {
        text: 'Delete',

        onPress: async () => {
          try {
            const updatedBills = bills.filter(bill => bill !== billToDelete);
            await AsyncStorage.setItem(
              'bills',
              JSON.stringify([...updatedBills].reverse()),
            );
            setBills(updatedBills);
            setOpenedBill(currentBill =>
              currentBill === billToDelete ? null : currentBill,
            );
          } catch (error) {
            console.log('Error deleting bill', error);
            Alert.alert('Error', 'Could not delete bill');
          }
        },
      },
    ]);
  };

  const clearAllBills = async () => {
    Alert.alert('Delete All Bills', 'Delete all bill history?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },

      {
        text: 'Delete All',

        onPress: async () => {
          try {
            await AsyncStorage.removeItem('bills');
            setBills([]);
            setOpenedBill(null);
            Alert.alert('Success', 'All bills deleted');
          } catch (error) {
            console.log('Error clearing bills', error);
            Alert.alert('Error', 'Could not delete bill history');
          }
        },
      },
    ]);
  };

  const shareOldBill = async (bill: Bill) => {
    try {
      let billMessage = '';
      billMessage += `Invoice No: ${bill.invoiceNo}\n`;
      billMessage += `Customer: ${bill.customerName}\n`;
      billMessage += `Date: ${bill.date}\n\n`;

      (bill.items || []).forEach((item, index) => {
        if (isPopulatedItem(item)) {
          const rowTotal = calculateRowTotal(item.qty, item.rate);
          billMessage += `${index + 1}. ${item.item}\n`;
          billMessage += `Qty: ${item.qty}\n`;
          billMessage += `Rate: ₹${item.rate}\n`;
          billMessage += `Total: ₹${rowTotal.toFixed(2)}\n\n`;
        }
      });

      billMessage += `Grand Total: ₹${Number(bill.total).toFixed(2)}\n`;

      await Share.open({
        message: billMessage,
        failOnCancel: false,
      });
    } catch {
      Alert.alert('Error', 'Could not share bill');
    }
  };

  // ==================== FINAL PRINT FUNCTION ====================
  // 5x7 inch single-page print - readable fonts, fits 15-18 items
  const printOldBill = async (bill: Bill) => {
    try {
      const filteredItems = (bill.items || []).filter(isPopulatedItem);

      let tableRows = '';
      for (const item of filteredItems) {
        const rowTotal = calculateRowTotal(item.qty, item.rate);
        const rowHtml =
          '<tr>' +
          '<td>' +
          escapeHtml((item.item || '').substring(0, 16)) +
          '</td>' +
          '<td>' +
          escapeHtml(item.qty || 0) +
          '</td>' +
          '<td>' +
          escapeHtml(item.rate || 0) +
          '</td>' +
          '<td>' +
          rowTotal.toFixed(0) +
          '</td>' +
          '</tr>';
        tableRows += rowHtml;
      }

      const billDate = getBillDateKey(bill) ?? '';

      const html =
        '<html>' +
        '<head>' +
        '<style>' +
        '@page { size: 5in 7in; margin: 0; }' +
        '* { margin: 0; padding: 0; box-sizing: border-box; }' +
        'html, body { overflow: hidden; height: 7in; }' +
        'body {' +
        'width: 5in;' +
        'height: 7in;' +
        'max-height: 7in;' +
        'padding: 4mm 4mm 3mm 4mm;' +
        'font-family: "Courier New", monospace;' +
        'font-size: 11pt;' +
        'line-height: 1.15;' +
        'overflow: hidden;' +
        '}' +
        '.header { text-align: center; border-bottom: 0.5px dashed #000; padding-bottom: 2mm; margin-bottom: 2mm; }' +
        '.shop-name { font-size: 14pt; font-weight: bold; }' +
        '.shop-sub { font-size: 8pt; }' +
        '.info-row { display: flex; justify-content: space-between; margin-bottom: 1mm; font-size: 9pt; }' +
        'table { width: 100%; border-collapse: collapse; margin-top: 2mm; font-size: 10pt; }' +
        'th, td { border: 0.5px solid #333; padding: 1.2mm 0.8mm; text-align: left; }' +
        'th { background: #f0f0f0; font-weight: bold; font-size: 9pt; padding: 1.5mm 0.8mm; }' +
        'td:nth-child(1) { width: 44%; }' +
        'td:nth-child(2) { width: 14%; text-align: center; }' +
        'td:nth-child(3) { width: 20%; text-align: right; }' +
        'td:nth-child(4) { width: 22%; text-align: right; }' +
        '.total-row { margin-top: 2mm; text-align: right; font-size: 14pt; font-weight: bold; border-top: 0.5px solid #000; padding-top: 2mm; }' +
        '.footer { margin-top: 3mm; text-align: center; font-size: 8pt; border-top: 0.5px dashed #000; padding-top: 2mm; }' +
        '.contact { font-size: 7pt; margin-top: 1.5mm; }' +
        '</style>' +
        '</head>' +
        '<body>' +
        '<div class="header">' +
        '<div class="shop-name">SANKESHWAR PARSHWANATH</div>' +
        '</div>' +
        '<div class="info-row">' +
        '<span><b>Inv:</b> ' +
        bill.invoiceNo +
        '</span>' +
        '<span><b>Date:</b> ' +
        escapeHtml(billDate) +
        '</span>' +
        '</div>' +
        '<div class="info-row" style="margin-bottom:2mm;">' +
        '<span><b>Cust:</b> ' +
        escapeHtml((bill.customerName || 'Walk-in').substring(0, 30)) +
        '</span>' +
        '</div>' +
        '<table>' +
        '<tr>' +
        '<th>Item</th>' +
        '<th>Qty</th>' +
        '<th>Rate</th>' +
        '<th>Amt</th>' +
        '</tr>' +
        tableRows +
        '</table>' +
        '<div class="total-row">' +
        'Total: ₹' +
        Number(bill.total || 0).toFixed(2) +
        '</div>' +
        '<div class="footer">' +
        '<b>THANK YOU VISIT AGAIN</b>' +
        '<div class="contact">' +
        'App/Website: +91 9324357300' +
        '</div>' +
        '</div>' +
        '</body>' +
        '</html>';

      await RNPrint.print({ html });
    } catch {
      Alert.alert('Error', 'Could not print bill');
    }
  };

  const renderItem = ({ item, index }: { item: Bill; index: number }) => {
    const billDate = getBillDateKey(item) ?? 'Unknown Date';
    const previousBillDate =
      index > 0 ? getBillDateKey(filteredBills[index - 1]) : null;
    const billIndex = bills.indexOf(item);
    const storageIndex = billIndex >= 0 ? bills.length - 1 - billIndex : -1;

    return (
      <View>
        {(index === 0 || previousBillDate !== billDate) && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderText}>{billDate}</Text>
          </View>
        )}

        <View style={styles.billCard}>
          <TouchableOpacity
            onPress={() => setOpenedBill(openedBill === item ? null : item)}
          >
            <Text style={styles.invoice}>
              Invoice No: {item?.invoiceNo ?? 'N/A'}
            </Text>

            <Text style={styles.customer}>
              Customer: {item?.customerName ?? 'Unknown Customer'}
            </Text>

            <Text style={styles.date}>{item?.date ?? 'No Date'}</Text>

            <Text style={styles.grandTotal}>
              Grand Total: ₹{Number(item?.total || 0).toFixed(2)}
            </Text>
          </TouchableOpacity>

          {openedBill === item && (
            <View>
              <View style={styles.line} />

              <Text style={styles.tableHeader}>ITEM | QTY | RATE | TOTAL</Text>

              <View style={styles.line} />

              {(item.items || []).map((product, idx: number) => {
                if (product.item || product.qty || product.rate) {
                  const total = calculateRowTotal(
                    product?.qty || 0,
                    product?.rate || 0,
                  );

                  return (
                    <Text key={idx} style={styles.productText}>
                      {product?.item ?? ''} | {product?.qty ?? ''} | ₹
                      {product?.rate ?? ''} | ₹{total.toFixed(2)}
                    </Text>
                  );
                }

                return null;
              })}

              <TouchableOpacity
                style={styles.editButton}
                onPress={() =>
                  navigation.navigate('Home', {
                    editBill: item,
                    editIndex: storageIndex,
                  })
                }
              >
                <Text style={styles.buttonText}>Edit Bill</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.printButton}
                onPress={() => printOldBill(item)}
              >
                <Text style={styles.buttonText}>Print Bill</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => shareOldBill(item)}
              >
                <Text style={styles.buttonText}>Share Bill</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteBill(item)}
              >
                <Text style={styles.buttonText}>Delete Bill</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <FlatList
      style={styles.container}
      data={filteredBills}
      keyExtractor={(bill, index) =>
        `${bill.invoiceNo}-${bill.createdAt}-${index}`
      }
      renderItem={renderItem}
      ListHeaderComponent={
        <>
          <Text style={styles.heading}>Bill History</Text>

          <TextInput
            placeholder="Search Customer Name"
            placeholderTextColor="#777"
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
          />

          <TouchableOpacity
            style={styles.dailySummaryButton}
            onPress={() => navigation.navigate('DailySummary')}
          >
            <Text style={styles.buttonText}>
              📊 Today's Business — Daily Summary
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.clearAllButton}
            onPress={clearAllBills}
          >
            <Text style={styles.buttonText}>Delete All Bills</Text>
          </TouchableOpacity>
        </>
      }
    />
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
    marginBottom: 20,
  },

  searchInput: {
    backgroundColor: '#fff',
    marginBottom: 20,
    padding: 12,
    borderRadius: 10,
    fontSize: 16,
    color: 'black',
    borderWidth: 1,
    borderColor: '#ddd',
  },

  clearAllButton: {
    backgroundColor: 'black',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },

  dailySummaryButton: {
    backgroundColor: '#1a1a2e',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },

  dateHeader: {
    marginBottom: 10,
    marginTop: 10,
  },

  dateHeaderText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'black',
  },

  billCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },

  invoice: {
    fontSize: 18,
    fontWeight: 'bold',
  },

  customer: {
    fontSize: 17,
    marginTop: 5,
  },

  status: {
    fontSize: 15,
    marginTop: 5,
    fontWeight: '600',
  },

  date: {
    color: 'gray',
    marginTop: 5,
  },

  line: {
    height: 1,
    backgroundColor: '#ccc',
    marginVertical: 10,
  },

  tableHeader: {
    fontWeight: 'bold',
    fontSize: 14,
  },

  productText: {
    fontSize: 14,
    marginBottom: 6,
  },

  grandTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
  },

  editButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
  },

  printButton: {
    backgroundColor: 'green',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },

  shareButton: {
    backgroundColor: 'blue',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },

  deleteButton: {
    backgroundColor: 'red',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },

  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});
