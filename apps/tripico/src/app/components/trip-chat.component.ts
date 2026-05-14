import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../core/chat.service';
import { AuthStateService } from '../core/auth-state.service';

@Component({
  selector: 'app-trip-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col h-[480px]">
      <header class="px-5 py-3 border-b border-stone-200 flex items-center justify-between">
        <h2 class="text-lg font-semibold">Czat wycieczki</h2>
        <span
          class="text-xs px-2 py-0.5 rounded-full"
          [class]="
            chat.connected()
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-stone-100 text-stone-500'
          "
        >
          {{ chat.connected() ? 'Połączono' : 'Łączenie…' }}
        </span>
      </header>

      <div
        #scroller
        class="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-stone-50"
      >
        @if (chat.messages().length === 0) {
          <p class="text-center text-sm text-stone-500 mt-6">
            Brak wiadomości. Zacznij rozmowę poniżej.
          </p>
        } @else {
          @for (msg of chat.messages(); track msg.id) {
            <div
              class="flex"
              [class.justify-end]="msg.senderId === currentUserId()"
            >
              <div
                class="max-w-[75%] rounded-2xl px-4 py-2 text-sm"
                [class]="
                  msg.senderId === currentUserId()
                    ? 'bg-teal-600 text-white rounded-br-md'
                    : 'bg-white border border-stone-200 text-stone-800 rounded-bl-md'
                "
              >
                @if (msg.senderId !== currentUserId()) {
                  <p class="text-xs font-medium mb-0.5 text-teal-700">
                    {{ msg.sender.displayName }}
                  </p>
                }
                <p class="whitespace-pre-wrap break-words">{{ msg.text }}</p>
                <p
                  class="text-[10px] mt-1 opacity-70"
                  [class.text-white]="msg.senderId === currentUserId()"
                  [class.text-stone-500]="msg.senderId !== currentUserId()"
                >
                  {{ msg.createdAt | date: 'shortTime' }}
                </p>
              </div>
            </div>
          }
        }
      </div>

      <form
        (ngSubmit)="send()"
        class="px-4 py-3 border-t border-stone-200 flex items-center gap-2"
      >
        <input
          [(ngModel)]="draft"
          name="message"
          type="text"
          placeholder="Napisz wiadomość…"
          maxlength="2000"
          [disabled]="!chat.connected()"
          class="flex-1 rounded-full border border-stone-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
        />
        <button
          type="submit"
          [disabled]="!draft.trim() || !chat.connected() || sending()"
          class="bg-teal-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
        >
          Wyślij
        </button>
      </form>

      @if (chat.error()) {
        <p class="px-4 py-2 text-xs text-red-600 border-t border-red-100 bg-red-50">
          {{ errorLabel() }}
        </p>
      }
    </section>
  `,
})
export class TripChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  readonly tripId = input.required<string>();

  protected readonly chat = inject(ChatService);
  private readonly authState = inject(AuthStateService);

  protected readonly sending = signal(false);
  protected draft = '';
  private shouldScroll = true;

  @ViewChild('scroller', { static: false })
  private scroller?: ElementRef<HTMLDivElement>;

  protected readonly currentUserId = () => this.authState.user()?.id ?? '';

  constructor() {
    // re-scroll to bottom whenever messages change
    effect(() => {
      this.chat.messages();
      this.shouldScroll = true;
    });
  }

  ngOnInit(): void {
    const id = this.tripId();
    this.chat.loadHistory(id).subscribe({
      next: (env) => this.chat.hydrate(env.data),
      error: () => {
        // 403 if not yet member — silently ignore; UI just shows empty
      },
    });
    this.chat.connect();
    this.chat.joinTrip(id);
  }

  ngOnDestroy(): void {
    this.chat.leaveTrip();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.scroller) {
      this.scroller.nativeElement.scrollTop =
        this.scroller.nativeElement.scrollHeight;
      this.shouldScroll = false;
    }
  }

  async send(): Promise<void> {
    const text = this.draft.trim();
    if (!text || this.sending()) return;
    this.sending.set(true);
    const result = await this.chat.sendMessage(text);
    this.sending.set(false);
    if (result) {
      this.draft = '';
    }
  }

  protected errorLabel(): string {
    const code = this.chat.error();
    switch (code) {
      case 'NOT_TRIP_PARTICIPANT':
        return 'Tylko uczestnicy mogą pisać w tym czacie.';
      case 'MESSAGE_TOO_LONG':
        return 'Wiadomość jest za długa (max 2000 znaków).';
      case 'EMPTY_MESSAGE':
        return 'Wiadomość nie może być pusta.';
      case 'UNAUTHENTICATED':
      case 'INVALID_TOKEN':
        return 'Sesja wygasła — zaloguj się ponownie.';
      case 'WS_CONNECT_FAILED':
        return 'Problem z połączeniem do czatu.';
      default:
        return code ?? '';
    }
  }
}
