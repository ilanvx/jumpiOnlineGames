// Jumpi Games: the small Microsoft Store helper of the computer program (only used by the Microsoft Store version).
// main.js runs it for each step and reads one line of JSON from it:
//   store-helper.exe products <hwnd>          -> the coin / membership add-ons with Microsoft's own prices
//   store-helper.exe buy <hwnd> <storeId>     -> Microsoft's purchase window (the money part is all Microsoft's)
//   store-helper.exe key <hwnd>               -> reads 2 lines (the server's ticket, the account's id) and makes the
//                                                "Microsoft Store ID key" the server uses to check what was bought
// It runs inside the Store package, so StoreContext knows the game and the Microsoft account signed in to the Store.
#include <windows.h>
#include <shobjidl_core.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.Services.Store.h>
#include <cstdio>
#include <iostream>
#include <string>

#pragma comment(lib, "windowsapp")
#pragma comment(lib, "ole32")
#pragma comment(lib, "user32")

using namespace winrt;
using namespace winrt::Windows::Services::Store;

static std::string utf8(std::wstring_view w) {
  if (w.empty()) return {};
  int n = WideCharToMultiByte(CP_UTF8, 0, w.data(), (int)w.size(), nullptr, 0, nullptr, nullptr);
  std::string s(n, '\0');
  WideCharToMultiByte(CP_UTF8, 0, w.data(), (int)w.size(), s.data(), n, nullptr, nullptr);
  return s;
}
static std::wstring wide(const std::string& s) {
  if (s.empty()) return {};
  int n = MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), nullptr, 0);
  std::wstring w(n, L'\0');
  MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), w.data(), n);
  return w;
}
static std::string js(std::wstring_view w) {
  std::string s = utf8(w), o = "\"";
  for (unsigned char c : s) {
    if (c == '"' || c == '\\') { o += '\\'; o += (char)c; }
    else if (c < 0x20) { char b[8]; sprintf_s(b, "\\u%04x", c); o += b; }
    else o += (char)c;
  }
  return o + "\"";
}
static std::string hr(winrt::hresult h) { char b[16]; sprintf_s(b, "0x%08X", (unsigned)h.value); return b; }
static int out(const std::string& line) { std::cout << line << std::endl; return 0; }
static int fail(const std::string& why) { return out("{\"ok\":false,\"error\":\"" + why + "\"}"); }

int wmain(int argc, wchar_t** argv) {
  if (argc < 3) return fail("usage");
  std::wstring cmd = argv[1];
  try {
    init_apartment();
    StoreContext ctx = StoreContext::GetDefault();
    // the purchase window belongs to the game's window (a desktop program has to say which window)
    HWND owner = (HWND)(ULONG_PTR)wcstoull(argv[2], nullptr, 16);
    if (owner && IsWindow(owner)) {
      auto init = ctx.as<::IInitializeWithWindow>();
      init->Initialize(owner);
    }

    if (cmd == L"products") {
      auto kinds = single_threaded_vector<hstring>({ L"Consumable", L"UnmanagedConsumable" });
      auto r = ctx.GetAssociatedStoreProductsAsync(kinds).get();
      if (r.ExtendedError() != S_OK) return fail(hr(r.ExtendedError()));
      std::string list;
      for (auto const& kv : r.Products()) {
        StoreProduct p = kv.Value();
        if (!list.empty()) list += ",";
        list += "{\"storeId\":" + js(p.StoreId()) + ",\"token\":" + js(p.InAppOfferToken()) + ",\"title\":" + js(p.Title()) +
                ",\"price\":" + js(p.Price().FormattedPrice()) + ",\"kind\":" + js(p.ProductKind()) + "}";
      }
      return out("{\"ok\":true,\"products\":[" + list + "]}");
    }

    if (cmd == L"buy") {
      if (argc < 4) return fail("usage");
      auto r = ctx.RequestPurchaseAsync(argv[3]).get();
      // 0 Succeeded, 1 AlreadyPurchased (bought before, not given yet), 2 NotPurchased (closed / cancelled),
      // 3 NetworkError, 4 ServerError
      return out("{\"ok\":true,\"status\":" + std::to_string((int)r.Status()) + ",\"error\":\"" +
                 (r.ExtendedError() == S_OK ? std::string() : hr(r.ExtendedError())) + "\"}");
    }

    if (cmd == L"key") {
      std::string ticket, uid;
      std::getline(std::cin, ticket);
      std::getline(std::cin, uid);
      while (!ticket.empty() && (ticket.back() == '\r' || ticket.back() == ' ')) ticket.pop_back();
      while (!uid.empty() && (uid.back() == '\r' || uid.back() == ' ')) uid.pop_back();
      if (ticket.empty() || uid.empty()) return fail("no ticket");
      hstring key = ctx.GetCustomerCollectionsIdAsync(hstring(wide(ticket)), hstring(wide(uid))).get();
      if (key.empty()) return fail("no key");
      return out("{\"ok\":true,\"key\":" + js(key) + "}");
    }
    return fail("unknown command");
  } catch (winrt::hresult_error const& e) {
    return fail(hr(e.code()));
  } catch (...) {
    return fail("crash");
  }
}
