"use client";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useBranches, Branch } from "@/hooks/use-branches";
import { useOrders, OrderData, Order } from "@/hooks/use-orders";
import { useProducts, Product } from "@/hooks/use-products";
import { useCustomers, Customer } from "@/hooks/use-customers";
import { useAuth } from "@/hooks/use-auth";
import { useDiscountSettings } from "@/hooks/use-discount-settings";
import { Timestamp, serverTimestamp, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { debounce } from "lodash";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { format } from "date-fns";

// Sub-components
import { CustomerSection } from "./components/CustomerSection";
import { ProductSection } from "./components/ProductSection";
import { FulfillmentSection } from "./components/FulfillmentSection";
import { OrderSummarySide } from "./components/OrderSummarySide";

interface OrderItem extends Product {
  quantity: number;
  isCustomProduct?: boolean;
}
type OrderType = "store" | "phone" | "naver" | "kakao" | "etc";
type ReceiptType = "store_pickup" | "pickup_reservation" | "delivery_reservation";
type MessageType = "card" | "ribbon";
type PaymentMethod = "card" | "cash" | "transfer" | "mainpay" | "shopping_mall" | "epay" | "kakao" | "apple";
type PaymentStatus = "pending" | "paid" | "completed" | "split_payment";

declare global {
  interface Window {
    daum: any;
  }
}

export default function NewOrderPage() {
  const { user } = useAuth();
  const { branches, loading: branchesLoading } = useBranches();
  const { products: allProducts, loading: productsLoading, fetchProducts } = useProducts();
  const { orders, loading: ordersLoading, addOrder, updateOrder } = useOrders();
  const { findCustomersByContact, customers } = useCustomers();
  const { discountSettings, getActiveDiscountRates } = useDiscountSettings();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');
  const { toast } = useToast();

  // --- STATE ---
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  // 지점이 선택되면 해당 지점의 상품 목록을 가져옴
  useEffect(() => {
    if (selectedBranch) {
      fetchProducts({ branch: selectedBranch.name, pageSize: 1000 });
    }
  }, [selectedBranch, fetchProducts]);

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  // Custom Product Dialog
  const [isCustomProductDialogOpen, setIsCustomProductDialogOpen] = useState(false);
  const [customProductName, setCustomProductName] = useState("");
  const [customProductPrice, setCustomProductPrice] = useState("");
  const [customProductQuantity, setCustomProductQuantity] = useState(1);

  // Delivery Fee
  const [deliveryFeeType, setDeliveryFeeType] = useState<"auto" | "manual">("auto");
  const [manualDeliveryFee, setManualDeliveryFee] = useState(0);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [itemSize, setItemSize] = useState<'small' | 'medium' | 'large'>('small');
  const [isExpress, setIsExpress] = useState(false);

  // Customer & Orderer
  const [ordererName, setOrdererName] = useState("");
  const [ordererContact, setOrdererContact] = useState("");
  const [ordererCompany, setOrdererCompany] = useState("");
  const [ordererEmail, setOrdererEmail] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [registerCustomer, setRegisterCustomer] = useState(true);

  // Search
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [contactSearchResults, setContactSearchResults] = useState<Customer[]>([]); // For existing logic if needed

  // Fulfillment
  const [orderType, setOrderType] = useState<OrderType>("store"); // Hidden/Default
  const [receiptType, setReceiptType] = useState<ReceiptType>("store_pickup");

  const getInitialTime = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const roundedMinutes = minutes < 15 ? 0 : minutes < 45 ? 30 : 0;
    const adjustedHours = minutes >= 45 ? hours + 1 : hours;
    if (adjustedHours < 7 || (adjustedHours === 7 && roundedMinutes < 30)) return "07:30";
    else if (adjustedHours >= 22) return "07:30";
    return `${String(adjustedHours).padStart(2, '0')}:${String(roundedMinutes).padStart(2, '0')}`;
  };

  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(new Date());
  const [scheduleTime, setScheduleTime] = useState(getInitialTime());
  const [pickerName, setPickerName] = useState(""); // Not explicitly used in UI anymore, merged into recipient logic or handled on submit
  const [pickerContact, setPickerContact] = useState("");

  const [recipientName, setRecipientName] = useState("");
  const [recipientContact, setRecipientContact] = useState("");
  const [isSameAsOrderer, setIsSameAsOrderer] = useState(true);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryAddressDetail, setDeliveryAddressDetail] = useState("");

  // Message
  // Message
  const [messageType, setMessageType] = useState<MessageType>("card");
  const [messageContent, setMessageContent] = useState("");
  // const [messageSender, setMessageSender] = useState(""); // Removed in favor of single input
  const [specialRequest, setSpecialRequest] = useState("");
  const [recentRibbonMessages, setRecentRibbonMessages] = useState<{ sender: string; content: string }[]>([]);

  // Fetch recent ribbon messages
  useEffect(() => {
    const fetchRecentRibbonMessages = async () => {
      if (messageType !== 'ribbon' || !selectedCustomer) {
        setRecentRibbonMessages([]);
        return;
      }

      try {
        const ordersRef = collection(db, 'orders');
        // Query orders by this customer with ribbon message
        // Using Orderer Name instead of contact might be less precise but contact is safer if available
        // Assuming selectedCustomer.contact matches orderer.contact
        if (!selectedCustomer.contact) return;

        const q = query(
          ordersRef,
          where('orderer.contact', '==', selectedCustomer.contact),
          where('message.type', '==', 'ribbon'),
          orderBy('orderDate', 'desc'),
          limit(10)
        );

        const snapshot = await getDocs(q);
        const messages: { sender: string; content: string }[] = [];
        const seen = new Set<string>();

        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.message?.content) {
            const sender = data.message.sender || data.orderer.name || '';
            const content = data.message.content;
            const key = `${sender}|${content}`;

            if (!seen.has(key)) {
              seen.add(key);
              messages.push({ sender, content });
            }
          }
        });

        setRecentRibbonMessages(messages.slice(0, 5)); // Top 5 unique
      } catch (error) {
        console.error("Error fetching ribbon history:", error);
      }
    };

    fetchRecentRibbonMessages();
  }, [messageType, selectedCustomer]);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");

  // Split Payment
  const [isSplitPaymentEnabled, setIsSplitPaymentEnabled] = useState(false);
  const [firstPaymentAmount, setFirstPaymentAmount] = useState(0);
  const [firstPaymentMethod, setFirstPaymentMethod] = useState<PaymentMethod>("card");
  const [secondPaymentMethod, setSecondPaymentMethod] = useState<PaymentMethod>("card");

  // Discount & Points
  const [usedPoints, setUsedPoints] = useState(0);
  const [selectedDiscountRate, setSelectedDiscountRate] = useState<number>(0);
  const [customDiscountRate, setCustomDiscountRate] = useState<number>(0);

  const [existingOrder, setExistingOrder] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- LOGIC ---

  const isAdmin = user?.role === '본사 관리자';
  const userBranch = user?.franchise;

  const availableBranches = useMemo(() => {
    if (isAdmin) return branches;
    return branches.filter(branch => branch.name === userBranch);
  }, [branches, isAdmin, userBranch]);

  useEffect(() => {
    if (!isAdmin && userBranch && !selectedBranch) {
      const userBranchData = branches.find(branch => branch.name === userBranch);
      if (userBranchData) setSelectedBranch(userBranchData);
    }
  }, [isAdmin, userBranch, selectedBranch, branches]);

  // Phone Format
  const formatPhoneNumber = (value: string) => {
    const raw = value.replace(/[^0-9]/g, '');
    let result = '';
    if (raw.startsWith('02')) {
      if (raw.length < 3) return raw;
      else if (raw.length < 6) result = `${raw.slice(0, 2)}-${raw.slice(2)}`;
      else if (raw.length < 10) result = `${raw.slice(0, 2)}-${raw.slice(2, 5)}-${raw.slice(5)}`;
      else result = `${raw.slice(0, 2)}-${raw.slice(2, 6)}-${raw.slice(6, 10)}`;
    } else {
      if (raw.length < 4) return raw;
      else if (raw.length < 7) result = `${raw.slice(0, 3)}-${raw.slice(3)}`;
      else if (raw.length < 11) result = `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6)}`;
      else result = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
    }
    return result;
  };

  const timeOptions = useMemo(() => {
    const options = [];
    for (let h = 7; h <= 22; h++) {
      for (let m = 0; m < 60; m += 30) {
        if (h === 7 && m < 30) continue;
        if (h === 22 && m > 0) continue;
        options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return options;
  }, []);

  const activeDiscountRates = useMemo(() => {
    if (!selectedBranch) return [];
    return getActiveDiscountRates(selectedBranch.id);
  }, [selectedBranch, getActiveDiscountRates]);

  const branchProducts = useMemo(() => {
    if (!selectedBranch) return [];
    return allProducts.filter(p => p.branch === selectedBranch.name);
  }, [allProducts, selectedBranch]);

  // Top Products Calculation
  const calculateTopProducts = useCallback((category: string, limit: number, isMidCategory = false, keyword = '') => {
    if (!branchProducts.length || !selectedBranch) return [];

    const productCounts: Record<string, number> = {};
    orders.forEach(order => {
      if (order.branchId === selectedBranch.id || order.branchName === selectedBranch.name) {
        order.items.forEach(item => {
          if (item.id) productCounts[item.id] = (productCounts[item.id] || 0) + item.quantity;
        });
      }
    });

    let targetProducts = branchProducts;
    if (keyword) {
      targetProducts = targetProducts.filter(p =>
        p.name.includes(keyword) ||
        (p.mainCategory === '자재' && p.midCategory?.includes(keyword))
      );
    } else if (isMidCategory) {
      targetProducts = targetProducts.filter(p => {
        const mCat = p.mainCategory || "";
        const midCat = p.midCategory || "";
        const name = p.name || "";

        if (category === '화환') return mCat.includes('화환') || midCat.includes('화환') || name.includes('화환') || name.includes('근조') || name.includes('축하');
        if (category === '동서양란') return mCat.includes('란') || midCat.includes('란') || name.includes('란') || mCat.includes('난') || midCat.includes('난') || name.includes('난') || name.includes('동양란') || name.includes('서양란') || name.includes('호접란');
        if (category === '플랜트') return mCat.includes('플랜트') || mCat.includes('관엽') || mCat.includes('공기정화');

        return mCat.includes(category) || midCat.includes(category) || name.includes(category);
      });
    } else {
      targetProducts = targetProducts.filter(p => p.mainCategory === category);
    }

    const sold = Object.entries(productCounts)
      .map(([id, count]) => ({ product: targetProducts.find(p => p.id === id), count }))
      .filter((x): x is { product: Product; count: number } => x.product !== undefined)
      .sort((a, b) => b.count - a.count)
      .map(x => x.product);

    const allAvailable = [...sold];
    if (allAvailable.length < limit) {
      const remaining = targetProducts
        .filter(p => !allAvailable.find(ap => ap.id === p.id))
        .sort((a, b) => (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0));
      allAvailable.push(...remaining);
    }
    return allAvailable.slice(0, limit);
  }, [branchProducts, selectedBranch, orders]);

  const dynamicCategories = useMemo(() => {
    if (!selectedBranch || !branchProducts.length) return [];

    // User requested specific categories and order
    const priority = ['꽃다발', '꽃바구니', '센터피스', '플랜트', '동서양란', '화환', '자재'];

    const getMatch = (p: Product, cat: string) => {
      const mCat = p.mainCategory || "";
      const midCat = p.midCategory || "";
      const name = p.name || "";

      if (cat === '화환') return mCat.includes('화환') || midCat.includes('화환') || name.includes('화환') || name.includes('근조') || name.includes('축하');
      if (cat === '동서양란') return mCat.includes('란') || midCat.includes('란') || name.includes('란') || mCat.includes('난') || midCat.includes('난') || name.includes('난') || name.includes('동양란') || name.includes('서양란') || name.includes('호접란');
      if (cat === '플랜트') return mCat.includes('플랜트') || mCat.includes('관엽') || mCat.includes('공기정화');

      return mCat.includes(cat) || midCat.includes(cat) || name.includes(cat);
    };

    return priority.map(cat => {
      const hasProducts = branchProducts.some(p => getMatch(p, cat));
      if (!hasProducts) return null;

      return {
        name: cat,
        products: calculateTopProducts(cat, 10, true) // Limited to 10 as requested
      };
    }).filter((c): c is any => c !== null);
  }, [branchProducts, orders, selectedBranch, calculateTopProducts]);


  // Order Edit Logic
  useEffect(() => {
    if (orderId && !ordersLoading && orders.length > 0 && !productsLoading && allProducts.length > 0 && !branchesLoading && branches.length > 0) {
      const foundOrder = orders.find(o => o.id === orderId);
      if (foundOrder) {
        setExistingOrder(foundOrder);
        const branch = branches.find(b => b.id === foundOrder.branchId);
        setSelectedBranch(branch || null);
        setOrderItems(foundOrder.items.map(item => {
          const product = allProducts.find(p => p.id === item.id && p.branch === foundOrder.branchName);
          return { ...product!, ...item, quantity: item.quantity }; // Merge to keep product details if available
        }).filter(item => item.id));

        if (foundOrder.deliveryInfo?.district && foundOrder.deliveryInfo.district !== '') {
          setDeliveryFeeType("auto");
          setSelectedDistrict(foundOrder.deliveryInfo.district);
        } else {
          setDeliveryFeeType("manual");
          setManualDeliveryFee(foundOrder.summary.deliveryFee);
        }

        setOrdererName(foundOrder.orderer.name);
        setOrdererContact(foundOrder.orderer.contact);
        setOrdererCompany(foundOrder.orderer.company || "");
        setOrdererEmail(foundOrder.orderer.email || "");
        setIsAnonymous(foundOrder.isAnonymous);
        setOrderType(foundOrder.orderType);

        // Receipt Type compatible
        const legacyReceiptType = foundOrder.receiptType as any;
        if (legacyReceiptType === 'pickup') setReceiptType('store_pickup');
        else if (legacyReceiptType === 'delivery') setReceiptType('delivery_reservation');
        else setReceiptType(foundOrder.receiptType as ReceiptType);

        const schedule = foundOrder.pickupInfo || foundOrder.deliveryInfo;
        if (schedule) {
          setScheduleDate(schedule.date ? new Date(schedule.date) : new Date());
          setScheduleTime(schedule.time);
        }

        if (foundOrder.deliveryInfo) {
          setRecipientName(foundOrder.deliveryInfo.recipientName);
          setRecipientContact(foundOrder.deliveryInfo.recipientContact);
          setDeliveryAddress(foundOrder.deliveryInfo.address);
          setDeliveryAddressDetail("");
          if (foundOrder.deliveryInfo.itemSize) setItemSize(foundOrder.deliveryInfo.itemSize);
          if (foundOrder.deliveryInfo.isExpress) setIsExpress(foundOrder.deliveryInfo.isExpress);
        }

        setMessageType(foundOrder.message.type);
        const messageParts = foundOrder.message.content.split('\n---\n');
        if (messageParts.length > 1) {
          // Combine back to single input format for editing
          setMessageContent(`${messageParts[0]} / ${messageParts[1]}`);
        } else {
          setMessageContent(foundOrder.message.content);
        }

        setSpecialRequest(foundOrder.request || "");
        setPaymentMethod(foundOrder.payment.method || "card");
        setPaymentStatus(foundOrder.payment.status as PaymentStatus);

        if (foundOrder.payment.isSplitPayment) {
          setIsSplitPaymentEnabled(true);
          setFirstPaymentAmount(foundOrder.payment.firstPaymentAmount || 0);
          setFirstPaymentMethod(foundOrder.payment.firstPaymentMethod || "card");
          setSecondPaymentMethod(foundOrder.payment.secondPaymentMethod || "card");
        }
      }
    }
  }, [orderId, orders, ordersLoading, branches, branchesLoading, allProducts, productsLoading]);

  // Effects
  useEffect(() => {
    if (receiptType === 'store_pickup' || receiptType === 'pickup_reservation') {
      // When switching to pickup, reset delivery fields if needed, but keeping picker filled is good
      // Current logic in FulfillmentSection sets recipientName/Contact for display.
      // We sync if "Same as Orderer" is checked? 
      if (isSameAsOrderer) {
        setRecipientName(ordererName);
        setRecipientContact(ordererContact);
      }
      setDeliveryFeeType("manual");
      setManualDeliveryFee(0);
      setSelectedDistrict(null);
      if (receiptType === 'store_pickup') {
        setScheduleDate(new Date());
        setScheduleTime(getInitialTime());
      }
    } else if (receiptType === 'delivery_reservation') {
      setDeliveryFeeType("auto");
      // For delivery, usually someone else receives it, so uncheck sameAsOrderer
      setIsSameAsOrderer(false);
      setRecipientName("");
      setRecipientContact("");
    }
  }, [receiptType]);

  // Sync Orderer to Recipient/Picker
  useEffect(() => {
    if (isSameAsOrderer) {
      setRecipientName(ordererName);
      setRecipientContact(ordererContact);
    }
  }, [ordererName, ordererContact, isSameAsOrderer]);

  // Delivery Fee Auto/Manual switch logic
  useEffect(() => {
    if (receiptType === 'delivery_reservation' && deliveryFeeType === 'auto') {
      if (!selectedBranch || !selectedBranch.deliveryFees || selectedBranch.deliveryFees.length === 0) {
        setDeliveryFeeType("manual");
        setManualDeliveryFee(0);
      }
    }
  }, [selectedBranch, deliveryFeeType, receiptType]);

  useEffect(() => {
    if (receiptType === 'delivery_reservation' && deliveryAddress && selectedBranch?.deliveryFees) {
      const matchedFee = selectedBranch.deliveryFees.find(df =>
        df.district !== '기타' && deliveryAddress.includes(df.district)
      );
      if (matchedFee) {
        setSelectedDistrict(matchedFee.district);
        setDeliveryFeeType('auto');
      }
    }
  }, [deliveryAddress, selectedBranch, receiptType]);

  // Split Payment Init



  // --- CALCULATIONS ---
  const deliveryFee = useMemo(() => {
    if (receiptType === 'store_pickup' || receiptType === 'pickup_reservation') return 0;
    if (deliveryFeeType === 'manual') return manualDeliveryFee;
    if (!selectedBranch) return 0;

    let totalFee = 0;

    // Base district fee
    if (selectedDistrict) {
      const feeInfo = selectedBranch.deliveryFees?.find(df => df.district === selectedDistrict);
      totalFee = feeInfo ? feeInfo.fee : (selectedBranch.deliveryFees?.find(df => df.district === "기타")?.fee ?? 0);
    } else {
      // If no district selected, use '기타' as fallback for auto if address exists, or 0
      totalFee = selectedBranch.deliveryFees?.find(df => df.district === "기타")?.fee ?? 0;
    }

    // Surcharges
    const surcharges = selectedBranch.surcharges || { mediumItem: 3000, largeItem: 5000, express: 10000 };
    if (itemSize === 'medium') totalFee += (surcharges.mediumItem ?? 3000);
    else if (itemSize === 'large') totalFee += (surcharges.largeItem ?? 5000);

    if (isExpress) totalFee += (surcharges.express ?? 10000);

    return totalFee;
  }, [deliveryFeeType, manualDeliveryFee, selectedBranch, selectedDistrict, receiptType, itemSize, isExpress]);

  const orderSummary = useMemo(() => {
    const subtotal = orderItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const discountRate = selectedDiscountRate > 0 ? selectedDiscountRate : (selectedDiscountRate === -1 ? customDiscountRate : 0);
    const discountAmount = Math.floor(subtotal * (discountRate / 100));
    const discountedSubtotal = subtotal - discountAmount;

    const canUsePoints = selectedCustomer && discountedSubtotal >= 5000;
    const maxUsablePoints = canUsePoints ? Math.min(selectedCustomer.points || 0, discountedSubtotal) : 0;
    const pointsToUse = Math.min(discountedSubtotal, usedPoints, maxUsablePoints);

    const finalSubtotal = discountedSubtotal - pointsToUse;
    const total = finalSubtotal + deliveryFee;

    // For VAT (Supplied 10/11)
    const supplyPrice = Math.round(total / 1.1);
    const vat = total - supplyPrice;

    return {
      subtotal,
      discountAmount, // Fixed typo in previous file?
      deliveryFee,
      pointsUsed: pointsToUse,
      total,
      vat,
      supplyPrice,
      money: total
    };
  }, [orderItems, deliveryFee, usedPoints, selectedCustomer, selectedDiscountRate, customDiscountRate]);

  // Split Payment Init
  useEffect(() => {
    if (isSplitPaymentEnabled && firstPaymentAmount === 0 && orderSummary.total > 0) {
      setFirstPaymentAmount(Math.floor(orderSummary.total * 0.5));
    }
  }, [orderSummary?.total, isSplitPaymentEnabled]);

  // --- HANDLERS ---
  const handleBranchChange = (branch: Branch) => {
    setOrderItems([]);
    setSelectedDistrict(null);
    setSelectedCustomer(null);
    setUsedPoints(0);
    setSelectedDiscountRate(0);
    setCustomDiscountRate(0);
    setSelectedBranch(branch);
  };

  const applyLastOrderPreferences = useCallback(async (contact: string, company?: string) => {
    try {
      if (!contact && (!company || !company.trim())) return;

      const ordersRef = collection(db, 'orders');
      let q;

      if (company && company.trim()) {
        q = query(
          ordersRef,
          where('orderer.company', '==', company.trim()),
          orderBy('orderDate', 'desc'),
          limit(1)
        );
      } else {
        q = query(
          ordersRef,
          where('orderer.contact', '==', contact),
          orderBy('orderDate', 'desc'),
          limit(1)
        );
      }

      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const lastOrder = snapshot.docs[0].data() as any;
        if (lastOrder.payment) {
          if (lastOrder.payment.method) setPaymentMethod(lastOrder.payment.method as PaymentMethod);
          if (lastOrder.payment.status) setPaymentStatus(lastOrder.payment.status as PaymentStatus);
        }
      }
    } catch (error) {
      console.error("Error applying last order preferences:", error);
    }
  }, []);

  const handleAddProduct = (product: Product) => {
    setOrderItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product.id);
      if (existingItem) {
        if (!existingItem.isCustomProduct && existingItem.quantity + 1 > existingItem.stock) {
          toast({ variant: 'destructive', title: '재고 부족', description: `최대 주문 가능 수량은 ${existingItem.stock}개 입니다.` });
          return prevItems;
        }
        return prevItems.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        if (!product.id.startsWith("custom") && product.stock < 1) {
          toast({ variant: 'destructive', title: '재고 없음', description: '선택하신 상품은 재고가 없습니다.' });
          return prevItems;
        }
        return [...prevItems, { ...product, quantity: 1, isCustomProduct: false }];
      }
    });
  };

  const handleAddCustomProduct = () => {
    if (!customProductName.trim() || !customProductPrice.trim()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '상품명과 가격을 모두 입력해주세요.' });
      return;
    }
    const price = Number(customProductPrice);
    if (isNaN(price) || price <= 0) return;

    const customProduct: OrderItem = {
      id: `custom_${Date.now()}`,
      docId: `custom_${Date.now()}`,
      name: customProductName.trim(),
      price: price,
      quantity: customProductQuantity,
      stock: 999,
      mainCategory: "기타",
      midCategory: "수동 추가",
      supplier: "수동 등록",
      size: "기타",
      color: "기타",
      branch: selectedBranch?.name || "",
      status: "active",
      isCustomProduct: true,
    };
    setOrderItems(prev => [...prev, customProduct]);
    setCustomProductName("");
    setCustomProductPrice("");
    setCustomProductQuantity(1);
    setIsCustomProductDialogOpen(false);
  };

  // Search Logic (Debounced)
  const debouncedCustomerSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setCustomerSearchResults([]);
        return;
      }
      setCustomerSearchLoading(true);
      try {
        // Client side filter of 'customers' (loaded by hook)
        // Or use findCustomersByContact if it was server side?
        // The existing code filtered 'customers' array mostly.
        // Let's use the 'customers' array from hook which is likely all customers or we need to fetch.
        // Wait, useCustomers hook usually loads all or some. 
        // In line 775 of original: `let results = customers;`

        const searchTerm = query.toLowerCase().trim();
        const results = customers.filter(c => {
          return c.name.toLowerCase().includes(searchTerm) ||
            c.contact.includes(searchTerm) ||
            (c.companyName || "").toLowerCase().includes(searchTerm);
        });
        setCustomerSearchResults(results);
      } finally {
        setCustomerSearchLoading(false);
      }
    }, 300),
    [customers]
  );

  useEffect(() => {
    debouncedCustomerSearch(customerSearchQuery);
  }, [customerSearchQuery, debouncedCustomerSearch]);


  const handleAddressSearch = () => {
    if (window.daum && window.daum.Postcode) {
      new window.daum.Postcode({
        oncomplete: function (data: any) {
          let fullAddress = data.address;
          let extraAddress = '';
          if (data.addressType === 'R') {
            if (data.bname !== '') extraAddress += data.bname;
            if (data.buildingName !== '') extraAddress += (extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName);
            fullAddress += (extraAddress !== '' ? ` (${extraAddress})` : '');
          }
          setDeliveryAddress(fullAddress);
          setDeliveryAddressDetail('');
          const district = data.sigungu;
          if (selectedBranch?.deliveryFees?.some(df => df.district === district)) {
            setSelectedDistrict(district);
          } else {
            setSelectedDistrict("기타");
          }
        }
      }).open();
    }
  };

  const handleCompleteOrder = async () => {
    setIsSubmitting(true);
    if (orderItems.length === 0) {
      toast({ variant: 'destructive', title: '주문 오류', description: '주문할 상품을 추가해주세요.' });
      setIsSubmitting(false); return;
    }
    if (!selectedBranch) {
      toast({ variant: 'destructive', title: '지점 오류', description: '지점을 선택해주세요.' });
      setIsSubmitting(false); return;
    }

    const orderPayload: OrderData = {
      branchId: selectedBranch.id,
      branchName: selectedBranch.name,
      orderDate: existingOrder?.orderDate || new Date(),
      status: existingOrder?.status || 'processing',
      orderType, // Default store
      receiptType,
      items: orderItems.map(({ id, name, quantity, price }) => ({ id, name, quantity, price })),
      summary: {
        subtotal: orderSummary.subtotal,
        discountAmount: orderSummary.discountAmount,
        discountRate: selectedDiscountRate === -1 ? customDiscountRate : selectedDiscountRate,
        deliveryFee: orderSummary.deliveryFee,
        pointsUsed: orderSummary.pointsUsed,
        // Calculate points earned logic
        pointsEarned: (discountSettings?.globalSettings?.allowPointAccumulation ?? true) ? Math.floor((orderSummary.total - orderSummary.pointsUsed) * 0.02) : 0,
        total: orderSummary.total,
      },
      orderer: {
        id: selectedCustomer?.id || "",
        name: ordererName,
        contact: ordererContact,
        company: ordererCompany,
        email: ordererEmail
      },
      isAnonymous,
      registerCustomer,
      payment: {
        method: isSplitPaymentEnabled ? undefined : paymentMethod,
        status: isSplitPaymentEnabled ? "split_payment" : paymentStatus,
        completedAt: (!isSplitPaymentEnabled && (paymentStatus === 'paid' || paymentStatus === 'completed')) ? serverTimestamp() as any : undefined,
        isSplitPayment: isSplitPaymentEnabled,
        firstPaymentAmount: isSplitPaymentEnabled ? firstPaymentAmount : undefined,
        firstPaymentDate: isSplitPaymentEnabled ? serverTimestamp() as any : undefined,
        firstPaymentMethod: isSplitPaymentEnabled ? firstPaymentMethod : undefined,
        secondPaymentAmount: isSplitPaymentEnabled ? (orderSummary.total - firstPaymentAmount) : undefined,
        secondPaymentDate: undefined,
        secondPaymentMethod: isSplitPaymentEnabled ? secondPaymentMethod : undefined,
      },
      pickupInfo: (receiptType === 'store_pickup' || receiptType === 'pickup_reservation') ? {
        date: scheduleDate ? format(scheduleDate, "yyyy-MM-dd") : '',
        time: scheduleTime,
        pickerName: recipientName, // We use recipientName state for both UI inputs now
        pickerContact: recipientContact
      } : null,
      deliveryInfo: receiptType === 'delivery_reservation' ? {
        date: scheduleDate ? format(scheduleDate, "yyyy-MM-dd") : '',
        time: scheduleTime,
        recipientName,
        recipientContact,
        address: `${deliveryAddress} ${deliveryAddressDetail}`,
        district: selectedDistrict ?? '',
        itemSize,
        isExpress,
      } : null,
      message: {
        type: messageType,
        content: (() => {
          // For Ribbon: Parse single input "Content / Sender"
          if (messageType === 'ribbon') {
            const parts = messageContent.split('/');
            let derivedContent = messageContent;
            let derivedSender = "";

            if (parts.length > 1) {
              derivedSender = parts.pop()?.trim() || "";
              derivedContent = parts.join('/').trim();
            } else {
              derivedContent = parts[0].trim();
            }
            // Fallback: If no sender extracted, use ordererName
            if (!derivedSender) derivedSender = ordererName;

            return derivedSender ? `${derivedContent}\n---\n${derivedSender}` : derivedContent;
          }

          // For Card: content is exact input, no sender split
          return messageContent;
        })(),
        sender: (() => {
          if (messageType === 'ribbon') {
            const parts = messageContent.split('/');
            let derivedSender = "";
            if (parts.length > 1) {
              derivedSender = parts.pop()?.trim() || "";
            }
            return derivedSender || ordererName;
          }
          // For Card: no separate sender
          return "";
        })()
      } as any,
      request: specialRequest,
    };

    try {
      if (existingOrder) {
        await updateOrder(existingOrder.id, orderPayload);
      } else {
        await addOrder(orderPayload);
      }
      router.push('/dashboard/orders');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title={existingOrder ? "주문 수정" : "주문 접수"}
        description={existingOrder ? "기존 주문을 수정합니다." : "새로운 주문을 등록합니다."}
      />

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 h-[calc(100vh-140px)]">

        {/* Left Column - Inputs (Scrollable) */}
        <div className="md:col-span-8 space-y-6 overflow-y-auto pr-2 pb-20">
          <CustomerSection
            selectedBranch={selectedBranch}
            availableBranches={availableBranches}
            onBranchChange={handleBranchChange}
            isAdmin={isAdmin}
            isCustomerSearchOpen={isCustomerSearchOpen}
            setIsCustomerSearchOpen={setIsCustomerSearchOpen}
            customerSearchQuery={customerSearchQuery}
            setCustomerSearchQuery={setCustomerSearchQuery}
            customerSearchResults={customerSearchResults}
            customerSearchLoading={customerSearchLoading}
            onCustomerSelect={(c) => {
              setSelectedCustomer(c);
              setOrdererName(c.name);
              setOrdererContact(c.contact);
              setOrdererCompany(c.companyName || "");
              setIsCustomerSearchOpen(false);
              setCustomerSearchQuery(c.name);
              applyLastOrderPreferences(c.contact, c.companyName);
            }}
            ordererName={ordererName}
            setOrdererName={setOrdererName}
            ordererContact={ordererContact}
            setOrdererContact={setOrdererContact}
            ordererCompany={ordererCompany}
            setOrdererCompany={setOrdererCompany}
            isAnonymous={isAnonymous}
            setIsAnonymous={setIsAnonymous}
            registerCustomer={registerCustomer}
            setRegisterCustomer={setRegisterCustomer}
            formatPhoneNumber={formatPhoneNumber}
          />

          <ProductSection
            onTabChange={(tab: string) => {
              if (tab === '경조화환' || tab === 'wreath') {
                setReceiptType('delivery_reservation');
              }
            }}
            allProducts={branchProducts}
            categories={dynamicCategories}
            onAddProduct={handleAddProduct}
            onOpenCustomProductDialog={() => setIsCustomProductDialogOpen(true)}
          />

          <FulfillmentSection
            receiptType={receiptType}
            setReceiptType={setReceiptType}
            scheduleDate={scheduleDate}
            setScheduleDate={setScheduleDate}
            scheduleTime={scheduleTime}
            setScheduleTime={setScheduleTime}
            timeOptions={timeOptions}
            recipientName={recipientName}
            setRecipientName={setRecipientName}
            recipientContact={recipientContact}
            setRecipientContact={setRecipientContact}
            deliveryAddress={deliveryAddress}
            setDeliveryAddress={setDeliveryAddress}
            deliveryAddressDetail={deliveryAddressDetail}
            setDeliveryAddressDetail={setDeliveryAddressDetail}
            onAddressSearch={handleAddressSearch}
            messageType={messageType}
            setMessageType={setMessageType}
            messageContent={messageContent}
            setMessageContent={setMessageContent}
            specialRequest={specialRequest}
            setSpecialRequest={setSpecialRequest}
            isSameAsOrderer={isSameAsOrderer}
            setIsSameAsOrderer={setIsSameAsOrderer}
            formatPhoneNumber={formatPhoneNumber}
            recentRibbonMessages={recentRibbonMessages}
            itemSize={itemSize}
            setItemSize={setItemSize}
            isExpress={isExpress}
            setIsExpress={setIsExpress}
          />
        </div>

        {/* Right Column - Summary (Sticky) */}
        <div className="md:col-span-4 h-full">
          <OrderSummarySide
            orderItems={orderItems}
            setOrderItems={setOrderItems}
            orderSummary={orderSummary}
            discountSettings={discountSettings}
            activeDiscountRates={activeDiscountRates}
            selectedDiscountRate={selectedDiscountRate}
            setSelectedDiscountRate={setSelectedDiscountRate}
            customDiscountRate={customDiscountRate}
            setCustomDiscountRate={setCustomDiscountRate}
            usedPoints={usedPoints}
            setUsedPoints={setUsedPoints}
            maxPoints={selectedCustomer?.points || 0}
            deliveryFeeType={deliveryFeeType}
            setDeliveryFeeType={setDeliveryFeeType}
            manualDeliveryFee={manualDeliveryFee}
            setManualDeliveryFee={setManualDeliveryFee}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            paymentStatus={paymentStatus}
            setPaymentStatus={setPaymentStatus}
            isSplitPaymentEnabled={isSplitPaymentEnabled}
            setIsSplitPaymentEnabled={setIsSplitPaymentEnabled}
            firstPaymentAmount={firstPaymentAmount}
            setFirstPaymentAmount={setFirstPaymentAmount}
            firstPaymentMethod={firstPaymentMethod}
            setFirstPaymentMethod={setFirstPaymentMethod}
            secondPaymentMethod={secondPaymentMethod}
            setSecondPaymentMethod={setSecondPaymentMethod}
            onSubmit={handleCompleteOrder}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={isCustomProductDialogOpen} onOpenChange={setIsCustomProductDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>수동 상품 추가</DialogTitle>
            <DialogDescription>
              등록되지 않은 상품을 임의 가격으로 주문에 추가합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-product-name">상품명</Label>
              <Input
                id="custom-product-name"
                placeholder="상품명을 입력하세요"
                value={customProductName}
                onChange={(e) => setCustomProductName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-product-price">가격</Label>
              <Input
                id="custom-product-price"
                type="number"
                placeholder="가격을 입력하세요"
                value={customProductPrice}
                onChange={(e) => setCustomProductPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-product-quantity">수량</Label>
              <Input
                id="custom-product-quantity"
                type="number"
                min="1"
                placeholder="수량을 입력하세요"
                value={customProductQuantity}
                onChange={(e) => setCustomProductQuantity(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCustomProductDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleAddCustomProduct}>
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
