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

  // 5x7 inch single-page Tax Invoice print for past bills (Maximized item capacity with GSTIN/FSSAI)
  const printOldBill = async (bill: Bill) => {
    try {
      const filteredItems = (bill.items || []).filter(isPopulatedItem);

      let tableRows = '';
      filteredItems.forEach((item, index) => {
        const rowTotal = calculateRowTotal(item.qty, item.rate);
        tableRows +=
          '<tr>' +
          '<td class="col-sr">' +
          (index + 1) +
          '</td>' +
          '<td class="col-desc">' +
          escapeHtml(item.item || '') +
          '</td>' +
          '<td class="col-qty">' +
          escapeHtml(item.qty || '0') +
          '</td>' +
          '<td class="col-rate">' +
          escapeHtml(item.rate || '0') +
          '</td>' +
          '<td class="col-amt">' +
          rowTotal.toFixed(2) +
          '</td>' +
          '</tr>';
      });

      const billDate = getBillDateKey(bill) ?? bill.date ?? '';

      const html =
        '<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
        '<meta charset="utf-8" />' +
        '<style>' +
        '@page { size: 5in 7in; margin: 0; }' +
        '* { margin: 0; padding: 0; box-sizing: border-box; }' +
        'html, body { width: 5in; height: 7in; overflow: hidden; font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #000; }' +
        '.page-container { width: 5in; height: 7in; padding: 2.5mm; display: flex; flex-direction: column; justify-content: space-between; }' +
        '.title-banner { text-align: center; font-weight: bold; font-size: 10.5pt; border: 1px solid #000; padding: 0.8mm; background: #f0f0f0; letter-spacing: 0.5px; text-transform: uppercase; }' +
        '.grid-header { display: flex; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px solid #000; }' +
        '.supplier-box { flex: 6; padding: 1mm 1.5mm; border-right: 1px solid #000; line-height: 1.2; font-size: 7.5pt; }' +
        '.shop-title { font-weight: bold; font-size: 9.5pt; margin-bottom: 0.5mm; }' +
        '.meta-box { flex: 4; padding: 1mm 1.5mm; line-height: 1.25; font-size: 7.5pt; }' +
        '.meta-row { display: flex; justify-content: space-between; margin-bottom: 0.3mm; }' +
        '.buyer-box { border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 1mm 1.5mm; font-size: 8pt; }' +
        'table.items-table { width: 100%; border-collapse: collapse; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px solid #000; margin-top: -1px; }' +
        'table.items-table th { border: 1px solid #000; background: #eaeaea; font-size: 7.5pt; font-weight: bold; padding: 0.8mm 0.8mm; text-align: center; }' +
        'table.items-table td { border: 1px solid #000; padding: 0.6mm 1mm; font-size: 7.5pt; vertical-align: middle; line-height: 1.15; }' +
        '.col-sr { width: 8%; text-align: center; }' +
        '.col-desc { width: 48%; text-align: left; }' +
        '.col-qty { width: 14%; text-align: center; }' +
        '.col-rate { width: 15%; text-align: right; }' +
        '.col-amt { width: 15%; text-align: right; }' +
        '.totals-box { border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 1mm 1.5mm; display: flex; justify-content: space-between; align-items: center; font-size: 8pt; }' +
        '.grand-total-text { font-size: 10pt; font-weight: bold; }' +
        '.footer-box { border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 1.5mm 2mm; display: flex; justify-content: space-between; align-items: flex-end; }' +
        '.footer-center { text-align: center; flex: 1; }' +
        '.thank-you-text { font-weight: bold; font-size: 9pt; }' +
        '.signatory-box { border-top: 1px solid #000; width: 1.3in; text-align: center; padding-top: 0.8mm; font-weight: bold; font-size: 7pt; }' +
        '</style>' +
        '</head>' +
        '<body>' +
        '<div class="page-container">' +
        '<div>' +
        '<div class="title-banner">TAX INVOICE</div>' +
        '<div class="grid-header">' +
        '<div class="supplier-box">' +
        '<div class="shop-title">JALARAM PROVISION STORE</div>' +
        '<div><b>GSTIN/UIN:</b> 27AFRPB3312A1Z2</div>' +
        '<div><b>FSSAI:</b> 11524006000494</div>' +
        '</div>' +
        '<div class="meta-box">' +
        '<div class="meta-row"><span><b>Invoice No:</b></span> <span>' + bill.invoiceNo + '</span></div>' +
        '<div class="meta-row"><span><b>Date:</b></span> <span>' + escapeHtml(billDate) + '</span></div>' +
        '</div>' +
        '</div>' +
        '<div class="buyer-box">' +
        '<b>Billed to:</b> ' + escapeHtml(bill.customerName || 'Walk-in') +
        '</div>' +
        '<table class="items-table">' +
        '<thead>' +
        '<tr>' +
        '<th class="col-sr">S.N</th>' +
        '<th class="col-desc">Item Description</th>' +
        '<th class="col-qty">Qty</th>' +
        '<th class="col-rate">Rate</th>' +
        '<th class="col-amt">Amount</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
        tableRows +
        '</tbody>' +
        '</table>' +
        '<div class="totals-box">' +
        '<span><b>Total Items:</b> ' + filteredItems.length + '</span>' +
        '<span class="grand-total-text">Grand Total: ₹' + Number(bill.total || 0).toFixed(2) + '</span>' +
        '</div>' +
        '</div>' +
        '<div class="footer-box">' +
        '<div class="footer-center">' +
        '<div class="thank-you-text">THANK YOU VISIT AGAIN</div>' +
        '</div>' +
        '<div class="signatory-box">' +
        'Authorised Signatory' +
        '</div>' +
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
