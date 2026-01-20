
"use client";
import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCustomers } from '@/hooks/use-customers';
import { Customer } from '@/hooks/use-customers';
interface CustomerSearchProps {
  onSelect: (customer: Customer) => void;
  selectedCustomer?: Customer | null;
}
export function CustomerSearch({ onSelect, selectedCustomer }: CustomerSearchProps) {
  const { customers, loading } = useCustomers();
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [showResults, setShowResults] = useState(false);
  useEffect(() => {
    if (searchTerm.length > 0) {
      const filtered = customers.filter(customer =>
        String(customer.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(customer.contact ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(customer.companyName ?? '').toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCustomers(filtered);
      setShowResults(true);
    } else {
      setFilteredCustomers([]);
      setShowResults(false);
    }
  }, [searchTerm, customers]);
  const handleSelect = (customer: Customer) => {
    onSelect(customer);
    setSearchTerm('');
    setShowResults(false);
  };
  const handleClear = () => {
    onSelect(null as any);
    setSearchTerm('');
    setShowResults(false);
  };
  if (selectedCustomer) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-medium">{selectedCustomer.name}</h3>
              <p className="text-sm text-gray-600">
                {selectedCustomer.companyName || '개인'} - {selectedCustomer.contact}
              </p>
              {selectedCustomer.address && (
                <p className="text-sm text-gray-500">{selectedCustomer.address}</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleClear}>
              변경
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="relative">
      <Input
        placeholder="고객명, 연락처, 회사명으로 검색..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => searchTerm && setShowResults(true)}
      />
      {showResults && (
        <Card className="absolute top-full left-0 right-0 z-10 mt-1 max-h-60 overflow-y-auto">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 text-center text-gray-500">검색 중...</div>
            ) : filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  onClick={() => handleSelect(customer)}
                >
                  <div className="font-medium">
                    {customer.name} ({customer.companyName || '개인'}) - {customer.contact}
                  </div>
                  {customer.address && (
                    <div className="text-sm text-gray-500">{customer.address}</div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500">
                검색 결과가 없습니다.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
