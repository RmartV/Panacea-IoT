import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronUp } from 'lucide-react';

export default function PreviousRecords({ isOpen, onClose, allHistoricalData, nodes }) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [sortBy, setSortBy] = useState('recent'); // 'recent' or 'oldest'
  const [filterMetric, setFilterMetric] = useState(null); // null, 'temp_high', 'humidity_high', 'light_low'
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter and sort data
  const filteredData = useMemo(() => {
    if (!allHistoricalData) return [];

    let filtered = selectedNode 
      ? allHistoricalData.filter(row => row.node_name === selectedNode)
      : allHistoricalData;

    // Apply metric filter
    if (filterMetric === 'temp_high') {
      filtered = filtered.filter(row => parseFloat(row.temperature) > 30);
    } else if (filterMetric === 'humidity_high') {
      filtered = filtered.filter(row => parseFloat(row.humidity) > 75);
    } else if (filterMetric === 'light_low') {
      filtered = filtered.filter(row => parseFloat(row.light_level) < 100);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return sortBy === 'recent' ? timeB - timeA : timeA - timeB;
    });

    return sorted;
  }, [allHistoricalData, selectedNode, sortBy, filterMetric]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-800 border border-slate-700 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <h2 className="text-lg font-bold text-slate-100">📊 Previous Records</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-100 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Filters */}
          <div className="p-4 border-b border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-700/20">
            {/* Node Filter */}
            <div>
              <label className="text-xs uppercase text-slate-400 mb-2 block">Node</label>
              <select
                value={selectedNode || ''}
                onChange={(e) => {
                  setSelectedNode(e.target.value || null);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-400"
              >
                <option value="">All Nodes</option>
                {Object.keys(nodes).map(node => (
                  <option key={node} value={node}>{node}</option>
                ))}
              </select>
            </div>

            {/* Metric Filter */}
            <div>
              <label className="text-xs uppercase text-slate-400 mb-2 block">Filter</label>
              <select
                value={filterMetric || ''}
                onChange={(e) => {
                  setFilterMetric(e.target.value || null);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-400"
              >
                <option value="">All Records</option>
                <option value="temp_high">High Temperature (&gt;30°C)</option>
                <option value="humidity_high">High Humidity (&gt;75%)</option>
                <option value="light_low">Low Light (&lt;100 lux)</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="text-xs uppercase text-slate-400 mb-2 block">Sort</label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-400"
              >
                <option value="recent">Most Recent</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>

            {/* Page Size */}
            <div>
              <label className="text-xs uppercase text-slate-400 mb-2 block">Per Page</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-400"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-auto flex-1">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-700/50 border-b border-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left text-slate-300 font-semibold">Timestamp</th>
                  <th className="px-4 py-2 text-left text-slate-300 font-semibold">Node</th>
                  <th className="px-4 py-2 text-right text-slate-300 font-semibold">Temp (°C)</th>
                  <th className="px-4 py-2 text-right text-slate-300 font-semibold">Humidity (%)</th>
                  <th className="px-4 py-2 text-right text-slate-300 font-semibold">Light (lux)</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.length > 0 ? (
                  paginatedData.map((row, idx) => (
                    <motion.tr
                      key={`${row.id}-${idx}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-400 font-mono">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-slate-200 font-mono">{row.node_name}</td>
                      <td className={`px-4 py-3 text-right font-mono ${
                        parseFloat(row.temperature) > 30 ? 'text-red-400' : 'text-slate-200'
                      }`}>
                        {parseFloat(row.temperature).toFixed(1)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${
                        parseFloat(row.humidity) > 75 ? 'text-blue-400' : 'text-slate-200'
                      }`}>
                        {parseFloat(row.humidity).toFixed(1)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${
                        parseFloat(row.light_level) < 100 ? 'text-yellow-400' : 'text-slate-200'
                      }`}>
                        {parseFloat(row.light_level).toFixed(0)}
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-slate-500">
                      No records found matching your filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer with Pagination */}
          <div className="flex items-center justify-between p-4 border-t border-slate-700 bg-slate-700/20">
            <div className="text-xs text-slate-400">
              Showing {paginatedData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} records
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 text-slate-400 hover:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronUp size={16} />
              </button>
              <span className="text-xs text-slate-400 px-3 py-1 bg-slate-700 rounded">
                {currentPage} / {totalPages || 1}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 text-slate-400 hover:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
