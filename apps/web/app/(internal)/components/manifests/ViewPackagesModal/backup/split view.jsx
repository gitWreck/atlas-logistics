<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-10">
  {/* Backdrop */}
  <div
    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
    onClick={onClose}
  />

  {/* Main Modal Container - Simplified to 90% width */}
  <div className="relative bg-slate-900 border border-slate-700 w-full lg:w-[90%] xl:w-[80%] rounded-xl shadow-2xl flex flex-col h-full max-h-[90vh] overflow-hidden">
    {/* HEADER (Keep your existing Header code here) */}
    <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50">
      {/* ... Header Content ... */}
    </div>

    {/* THE BODY: Forced Grid Layout */}
    <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
      {/* LEFT COLUMN: Sidebar (Takes 4 of 12 columns) */}
      <div className="md:col-span-4 lg:col-span-3 border-r border-slate-800 bg-slate-950/20 p-6 space-y-6 overflow-y-auto custom-scrollbar">
        <div className="space-y-3">
          <PackageStatusCard
            icon={faCube}
            label="Count"
            value={`${packages.length} items`}
          />
          <PackageStatusCard
            icon={faWeightHanging}
            label="Total Weight"
            value={`${totalWeight.toFixed(2)} kg`}
          />
        </div>

        <div className="pt-6 border-t border-slate-800">
          {/* Your Add New Package Form Logic */}
          {isAdding ? (
            <div className="bg-blue-500/5 border border-blue-500/30 p-4 rounded-xl space-y-4">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                New Package
              </p>
              <input
                className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-sm text-white"
                placeholder="Description"
                value={newPackage.description}
                onChange={(e) =>
                  setNewPackage({ ...newPackage, description: e.target.value })
                }
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddSave}
                  className="flex-1 bg-blue-600 text-white py-2 rounded text-xs font-bold"
                >
                  Add
                </button>
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-2 bg-slate-800 text-slate-400 rounded text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-10 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 hover:text-blue-400 hover:border-blue-500/30 transition-all font-bold text-xs uppercase"
            >
              + Add Item
            </button>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: List & Actions (Takes 8 of 12 columns) */}
      <div className="md:col-span-8 lg:col-span-9 flex flex-col bg-slate-900 overflow-hidden">
        {/* Bulk Actions Header */}
        <div className="bg-slate-950/40 border-b border-slate-800">
          <PackageBulkActions
            selectedCount={selectedIndices.size}
            canSplit={canSplit}
            isLocked={parentLocked}
            isSaving={isSaving}
            onSplit={handleSplitShipment}
            onStatusChange={handleBulkStatusChange}
          />
          {/* Search Box inside the right column header */}
          <div className="p-4 relative">
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              placeholder="Search by description or barcode..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:border-blue-500 outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-3">
          {paginatedData.map((pkg) => {
            const originalIdx = packages.findIndex(
              (p) => p.trackingNumber === pkg.trackingNumber,
            );
            return (
              <PackageItemCard
                key={pkg.trackingNumber}
                pkg={pkg}
                idx={originalIdx}
                isSelected={selectedIndices.has(originalIdx)}
                onSelect={handleSelectOne}
                /* ... other props ... */
              />
            );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-slate-800 sticky bottom-0 bg-slate-900">
              <span className="text-xs text-slate-500">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-2 text-slate-400"
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  className="p-2 text-slate-400"
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* FOOTER */}
    <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
      <button
        onClick={onClose}
        className="px-8 py-2 bg-slate-800 text-white rounded font-bold text-sm"
      >
        Close
      </button>
    </div>
  </div>
</div>;
