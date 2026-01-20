"use client";

import React, { useState } from 'react';

const VacationRequestForm = () => {
  const [formData, setFormData] = useState({
    applicantName: '',
    department: '',
    leaveType: '연차',
    startDate: '',
    endDate: '',
    reason: '',
    emergencyContact: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO: Add logic to submit the form data to the server

    alert('휴가 신청이 완료되었습니다.');
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">휴가 신청서</h2>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 신청자 */}
          <div>
            <label htmlFor="applicantName" className="block text-sm font-medium text-gray-700 mb-1">신청자</label>
            <input
              type="text"
              name="applicantName"
              id="applicantName"
              value={formData.applicantName}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          {/* 부서 */}
          <div>
            <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">부서</label>
            <input
              type="text"
              name="department"
              id="department"
              value={formData.department}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          {/* 휴가 종류 */}
          <div>
            <label htmlFor="leaveType" className="block text-sm font-medium text-gray-700 mb-1">휴가 종류</label>
            <select
              name="leaveType"
              id="leaveType"
              value={formData.leaveType}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option>연차</option>
              <option>병가</option>
              <option>경조사</option>
              <option>공가</option>
              <option>기타</option>
            </select>
          </div>

          {/* 비상 연락처 */}
          <div>
            <label htmlFor="emergencyContact" className="block text-sm font-medium text-gray-700 mb-1">휴가중 비상연락처</label>
            <input
              type="text"
              name="emergencyContact"
              id="emergencyContact"
              value={formData.emergencyContact}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          {/* 시작일 */}
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">휴가 시작일</label>
            <input
              type="date"
              name="startDate"
              id="startDate"
              value={formData.startDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          {/* 종료일 */}
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">휴가 종료일</label>
            <input
              type="date"
              name="endDate"
              id="endDate"
              value={formData.endDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          {/* 사유 */}
          <div className="md:col-span-2">
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">휴가 사유</label>
            <textarea
              name="reason"
              id="reason"
              rows={4}
              value={formData.reason}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            ></textarea>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            신청하기
          </button>
        </div>
      </form>
    </div>
  );
};

export default VacationRequestForm;
