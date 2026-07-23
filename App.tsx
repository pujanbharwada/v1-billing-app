import React, { useState, useEffect } from 'react';

import {
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  View,
  StyleSheet,
  Alert,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import Share from 'react-native-share';
import RNPrint from 'react-native-print';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HistoryScreen from './screens/HistoryScreen';
import DailySummaryScreen from './screens/DailySummaryScreen';
import {
  Bill,
  BillItem,
  calculateRowTotal,
  createEmptyItems,
  escapeHtml,
  formatBillTimestamp,
  isPopulatedItem,
  isValidNumericInput,
  normalizeItems,
} from './utils/billing';

const Stack = createNativeStackNavigator();

function HomeScreen({ navigation, route }: any) {
  const [customerName, setCustomerName] = useState('');
  const [billText, setBillText] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(1);
  const [savedInvoiceNumber, setSavedInvoiceNumber] = useState<number | null>(
    null,
  );
  const [paymentStatus, setPaymentStatus] = useState('Unpaid');
  const [items, setItems] = useState<BillItem[]>(createEmptyItems());

  const editBill = route?.params?.editBill as Bill | undefined;
  const editIndex = route?.params?.editIndex as number | undefined;
  const isEditing =
    Boolean(editBill) && Number.isInteger(editIndex) && Number(editIndex) >= 0;

  useEffect(() => {
    const loadInvoiceNumber = async () => {
      try {
        const savedInvoice = await AsyncStorage.getItem('invoiceNumber');
        const parsedInvoice = Number(savedInvoice);

        if (Number.isInteger(parsedInvoice) && parsedInvoice > 0) {
          setInvoiceNumber(parsedInvoice);
        }
      } catch (error) {
        console.log('Error loading invoice number', error);
      }
    };

    const deleteOldBills = async () => {
      try {
        const storedBills = await AsyncStorage.getItem('bills');

        if (!storedBills) {
          return;
        }

        const parsedBills = JSON.parse(storedBills);
        if (!Array.isArray(parsedBills)) {
          return;
        }

        const currentTime = Date.now();
        const filteredBills = parsedBills.filter((bill: Bill) => {
          const createdAt = Number(bill?.createdAt);
          if (!Number.isFinite(createdAt) || createdAt <= 0) {
            return true;
          }

          const differenceInDays =
            (currentTime - createdAt) / (1000 * 60 * 60 * 24);

          return differenceInDays <= 7;
        });

        if (filteredBills.length !== parsedBills.length) {
          await AsyncStorage.setItem('bills', JSON.stringify(filteredBills));
        }
      } catch (error) {
        console.log('Error deleting old bills', error);
      }
    };

    loadInvoiceNumber();
    deleteOldBills();
  }, []);

  useEffect(() => {
    if (editBill) {
      setCustomerName(editBill.customerName ?? '');
      setPaymentStatus(editBill.paymentStatus ?? 'Unpaid');
      setItems(normalizeItems(editBill.items));
      setSavedInvoiceNumber(editBill.invoiceNo);
      setBillText('');
    }
  }, [editBill]);

  const updateItem = (index: number, field: keyof BillItem, value: string) => {
    const updatedItems = [...items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };

    setItems(updatedItems);
    setSavedInvoiceNumber(null);
    setBillText('');
  };

  const grandTotal = Number(
    items
      .reduce((sum, currentItem) => {
        return sum + calculateRowTotal(currentItem.qty, currentItem.rate);
      }, 0)
      .toFixed(2),
  );

  const generateBill = async () => {
    const errors: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      const hasItem = row.item.trim() !== '';
      const hasQty = row.qty.trim() !== '';
      const hasRate = row.rate.trim() !== '';

      if (hasItem && !hasQty) {
        errors.push(`Row ${i + 1}: Qty is empty`);
      }

      if (hasItem && !hasRate) {
        errors.push(`Row ${i + 1}: Rate is empty`);
      }

      if ((hasQty || hasRate) && !hasItem) {
        errors.push(`Row ${i + 1}: Item name is empty`);
      }

      if (hasQty && !isValidNumericInput(row.qty)) {
        errors.push(`Row ${i + 1}: Qty is invalid`);
      }

      if (hasRate && !isValidNumericInput(row.rate)) {
        errors.push(`Row ${i + 1}: Rate is invalid`);
      }
    }

    if (!items.some(isPopulatedItem)) {
      errors.push('Add at least one item');
    }

    if (errors.length > 0) {
      Alert.alert('Validation Errors', errors.join('\n'));
      return;
    }

    const total = items.reduce(
      (sum, item) => sum + calculateRowTotal(item.qty, item.rate),
      0,
    );
    const now = new Date();
    const billInvoiceNumber =
      isEditing && editBill ? editBill.invoiceNo : invoiceNumber;
    const newBill: Bill = {
      invoiceNo: billInvoiceNumber,
      customerName,
      paymentStatus,
      items,
      total: Number(total.toFixed(2)),
      createdAt:
        isEditing && editBill?.createdAt ? editBill.createdAt : now.getTime(),
      date:
        isEditing && editBill?.date ? editBill.date : formatBillTimestamp(now),
    };

    try {
      const existingBills = await AsyncStorage.getItem('bills');
      const parsedBills = existingBills ? JSON.parse(existingBills) : [];
      const bills: Bill[] = Array.isArray(parsedBills) ? parsedBills : [];

      if (isEditing && editBill) {
        const storageIndex = Number(editIndex);
        if (storageIndex >= bills.length) {
          throw new Error('The bill being edited no longer exists');
        }
        bills[storageIndex] = newBill;
      } else {
        bills.push(newBill);
      }

      await AsyncStorage.setItem('bills', JSON.stringify(bills));

      if (isEditing) {
        Alert.alert('Success', 'Bill Updated Successfully!');
        navigation.setParams({
          editBill: undefined,
          editIndex: undefined,
        });
        setCustomerName('');
        setPaymentStatus('Unpaid');
        setItems(createEmptyItems());
        setBillText('');
        setSavedInvoiceNumber(null);
        navigation.navigate('History');
        return;
      }

      let finalBill = '';
      finalBill += `\n`;
      finalBill += `Invoice No : ${billInvoiceNumber}\n`;
      finalBill += `========================================\n`;
      finalBill += `Customer : ${customerName}\n`;
      finalBill += `Date     : ${now.toLocaleDateString()}\n`;
      finalBill += `Time     : ${now.toLocaleTimeString()}\n`;
      finalBill += `========================================\n`;
      finalBill += `ITEM         QTY      RATE       TOTAL\n`;
      finalBill += `------------------------------------------------\n`;

      items.forEach(item => {
        if (isPopulatedItem(item)) {
          const rowTotal = calculateRowTotal(item.qty, item.rate);
          finalBill += `${item.item.padEnd(12)} ${String(item.qty).padEnd(
            8,
          )} ${String(item.rate).padEnd(10)} ₹${rowTotal.toFixed(2)}\n`;
        }
      });

      finalBill += `------------------------------------------------\n`;
      finalBill += `Grand Total : ₹${grandTotal.toFixed(2)}\n`;
      finalBill += `========================================\n`;
      finalBill += `        THANK YOU VISIT AGAIN\n`;

      setBillText(finalBill);
      setSavedInvoiceNumber(billInvoiceNumber);

      const nextInvoice = invoiceNumber + 1;
      setInvoiceNumber(nextInvoice);
      await AsyncStorage.setItem('invoiceNumber', String(nextInvoice));

      Alert.alert('Success', 'Bill Saved Successfully!');
    } catch (error) {
      console.log('Error saving bill', error);
      Alert.alert('Error', 'Error Saving Bill');
    }
  };

  const activeInvoiceNumber =
    editBill?.invoiceNo ?? savedInvoiceNumber ?? invoiceNumber;

  const shareBill = async () => {
    try {
      let billMessage = ` SANKESHWAR PARSHWANATH\n\n`;
      billMessage += `Customer: ${customerName}\n`;
      billMessage += `Invoice No: ${activeInvoiceNumber}\n`;
      billMessage += `Date: ${new Date().toLocaleDateString()}\n`;
      billMessage += `Time: ${new Date().toLocaleTimeString()}\n\n`;

      items.forEach((item, index) => {
        if (isPopulatedItem(item)) {
          const rowTotal = calculateRowTotal(item.qty, item.rate);
          billMessage += `${index + 1}. ${item.item}\n`;
          billMessage += `Rate: ₹${item.rate}\n`;
          billMessage += `Total: ₹${rowTotal.toFixed(2)}\n\n`;
        }
      });

      billMessage += `Grand Total: ₹${grandTotal.toFixed(2)}\n`;

      await Share.open({
        message: billMessage,
        failOnCancel: false,
      });
    } catch {
      Alert.alert('Error', 'Failed to share bill');
    }
  };

  const newBill = () => {
    setCustomerName('');
    setPaymentStatus('Unpaid');
    setItems(createEmptyItems());
    setBillText('');
    setSavedInvoiceNumber(null);
    Alert.alert('New Bill', 'Ready for next customer');
    navigation.replace('Home');
  };

  // ==================== FINAL PRINT FUNCTION ====================
  // 5x7 inch single-page print - readable fonts, fits 15-18 items
  const printBill = async () => {
    try {
      const filteredItems = items.filter(isPopulatedItem);

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
        activeInvoiceNumber +
        '</span>' +
        '<span><b>Date:</b> ' +
        new Date().toLocaleDateString('en-IN') +
        '</span>' +
        '</div>' +
        '<div class="info-row">' +
        '<span><b>Time:</b> ' +
        new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        }) +
        '</span>' +
        '</div>' +
        '<div class="info-row" style="margin-bottom:2mm;">' +
        '<span><b>Cust:</b> ' +
        escapeHtml((customerName || 'Walk-in').substring(0, 30)) +
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
        grandTotal.toFixed(2) +
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
    } catch (error) {
      console.log('Error printing bill', error);
      Alert.alert('Error', 'Could not generate printable bill');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Sankeshwar Parshwanath</Text>

        <TextInput
          placeholder="Customer Name"
          placeholderTextColor="#777"
          style={styles.customerInput}
          value={customerName}
          onChangeText={text => {
            setCustomerName(text);
            setSavedInvoiceNumber(null);
            setBillText('');
          }}
        />

        {items.map((currentItem, index) => {
          const rowTotal = calculateRowTotal(currentItem.qty, currentItem.rate);

          return (
            <View style={styles.row} key={index}>
              <TextInput
                placeholder={`Item ${index + 1}`}
                placeholderTextColor="#777"
                style={styles.itemInput}
                value={currentItem.item}
                onChangeText={text => updateItem(index, 'item', text)}
              />

              <TextInput
                placeholder="Qty"
                placeholderTextColor="#777"
                keyboardType="numeric"
                style={styles.smallInput}
                value={currentItem.qty}
                onChangeText={text => updateItem(index, 'qty', text)}
              />

              <TextInput
                placeholder="Rate"
                placeholderTextColor="#777"
                keyboardType="numeric"
                style={styles.smallInput}
                value={currentItem.rate}
                onChangeText={text => updateItem(index, 'rate', text)}
              />

              <Text style={styles.totalBox}>₹{rowTotal.toFixed(2)}</Text>
            </View>
          );
        })}

        <Text style={styles.grandTotal}>
          Grand Total: ₹ {grandTotal.toFixed(2)}
        </Text>

        <TouchableOpacity style={styles.button} onPress={generateBill}>
          <Text style={styles.buttonText}>
            {isEditing ? 'Update Bill' : 'Generate Bill'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={shareBill}>
          <Text style={styles.buttonText}>Share Bill</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={newBill}>
          <Text style={styles.buttonText}>New Bill</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={printBill}>
          <Text style={styles.buttonText}>Print / Save PDF</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('History')}
        >
          <Text style={styles.buttonText}>View Bill History</Text>
        </TouchableOpacity>

        <Text style={styles.billText}>{billText}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />

        <Stack.Screen name="History" component={HistoryScreen} />

        <Stack.Screen
          name="DailySummary"
          component={DailySummaryScreen}
          options={{ title: 'Daily Summary' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
  },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 25,
  },

  customerInput: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 20,
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    color: 'black',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 10,
  },

  itemInput: {
    flex: 2,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginRight: 5,
    fontSize: 14,
    color: 'black',
  },

  smallInput: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginRight: 5,
    textAlign: 'center',
    fontSize: 14,
    color: 'black',
  },

  totalBox: {
    flex: 1,
    backgroundColor: '#dff0d8',
    padding: 10,
    borderRadius: 8,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 13,
    color: 'black',
  },

  grandTotal: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 25,
    marginBottom: 25,
    color: 'black',
  },

  button: {
    backgroundColor: 'green',
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 10,
    marginBottom: 25,
  },

  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },

  statusButton: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    elevation: 2,
  },

  statusText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: 'black',
  },
  billText: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 10,
    fontSize: 16,
    lineHeight: 28,
    color: 'black',
  },
});
